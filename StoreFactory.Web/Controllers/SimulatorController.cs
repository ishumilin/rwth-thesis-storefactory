using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using StoreFactory.Web.Services;
using StoreFactory.Web.Models;
using StoreFactory.Web.Data;

namespace StoreFactory.Web.Controllers
{
    public class SimulatorController : Controller
    {
        private readonly IShrinkageCalculator _calculator;

        // Simple in-memory experiment log (demo only)
        private static readonly List<ExperimentEntry> _experiments = new List<ExperimentEntry>();

        public SimulatorController()
        {
            // In a real app, we would use DI, but for simplicity here we instantiate directly
            // or assume it's injected if we configured Startup.cs properly.
            _calculator = new ShrinkageCalculator();
        }

        public IActionResult Index()
        {
            var model = new SimulatorViewModel
            {
                Materials = MockDatabase.Materials.Select(m => new SelectListItem
                {
                    Value = m.Id.ToString(),
                    Text = m.Name
                }).ToList(),
                Temperature = 180,
                DwellTime = 2.5
            };
            return View(model);
        }

        [HttpPost]
        public JsonResult Calculate(int materialId, double temperature, double dwellTime)
        {
            var result = _calculator.Calculate(materialId, temperature, dwellTime);
            return Json(result);
        }

        [HttpPost]
        public JsonResult Curve(CurveRequest request)
        {
            var res = new CurveResponse();

            var start = request.StartTemperature;
            var end = request.EndTemperature;
            var step = request.Step <= 0 ? 10 : request.Step;

            for (var t = start; t <= end; t += step)
            {
                var r = _calculator.Calculate(request.MaterialId, t, request.DwellTime);
                res.Temperatures.Add(t);
                res.Length.Add(r.LengthFactor);
                res.Width.Add(r.WidthFactor);
                res.Sleeve.Add(r.SleeveFactor);
            }

            return Json(res);
        }

        [HttpPost]
        public JsonResult Surface(SurfaceRequest request)
        {
            var temps = new List<int>();
            for (var t = request.StartTemperature; t <= request.EndTemperature; t += Math.Max(1, request.StepTemperature))
            {
                temps.Add(t);
            }

            var dwells = new List<double>();
            for (var d = request.StartDwellTime; d <= request.EndDwellTime + 1e-9; d += Math.Max(0.1, request.StepDwellTime))
            {
                // round for stable labels
                dwells.Add(Math.Round(d, 2));
            }

            Func<ShrinkageData, double> pick = r => r.LengthFactor;
            if (string.Equals(request.Factor, "width", StringComparison.OrdinalIgnoreCase)) pick = r => r.WidthFactor;
            if (string.Equals(request.Factor, "sleeve", StringComparison.OrdinalIgnoreCase)) pick = r => r.SleeveFactor;

            var values = new List<List<double>>();
            foreach (var d in dwells)
            {
                var row = new List<double>();
                foreach (var t in temps)
                {
                    var r = _calculator.Calculate(request.MaterialId, t, d);
                    row.Add(pick(r));
                }
                values.Add(row);
            }

            return Json(new SurfaceResponse
            {
                Temperatures = temps,
                DwellTimes = dwells,
                Values = values
            });
        }

        [HttpPost]
        public JsonResult Optimize(OptimizeRequest request)
        {
            Func<ShrinkageData, double> pick = r => r.LengthFactor;
            if (string.Equals(request.Factor, "width", StringComparison.OrdinalIgnoreCase)) pick = r => r.WidthFactor;
            if (string.Equals(request.Factor, "sleeve", StringComparison.OrdinalIgnoreCase)) pick = r => r.SleeveFactor;

            var best = new OptimizeResponse { Score = double.PositiveInfinity };

            for (var t = request.StartTemperature; t <= request.EndTemperature; t += Math.Max(1, request.StepTemperature))
            {
                for (var d = request.StartDwellTime; d <= request.EndDwellTime + 1e-9; d += Math.Max(0.1, request.StepDwellTime))
                {
                    var r = _calculator.Calculate(request.MaterialId, t, d);
                    var val = pick(r);
                    var score = Math.Abs(val - request.Target);

                    // Secondary tie-break: lower energy ~ lower temp + lower dwell
                    score += 0.0001 * t + 0.001 * d;

                    if (score < best.Score)
                    {
                        best.Score = score;
                        best.Temperature = t;
                        best.DwellTime = Math.Round(d, 2);
                        best.Result = r;
                    }
                }
            }

            return Json(best);
        }

        [HttpPost]
        public JsonResult Recommend(RecommendRequest request)
        {
            if (request == null)
            {
                return Json(new RecommendResponse { Mode = "unknown" });
            }

            var res = new RecommendResponse { Mode = request.Mode ?? "throughput" };

            bool IsFeasible(ShrinkageData r, double t, double d)
            {
                if (r == null) return false;
                if (r.LengthFactor < request.MinLengthFactor) return false;
                if (r.WidthFactor < request.MinWidthFactor) return false;
                if (r.SleeveFactor < request.MinSleeveFactor) return false;
                if (request.MaxTemperature.HasValue && t > request.MaxTemperature.Value) return false;
                if (request.MaxDwellTime.HasValue && d > request.MaxDwellTime.Value) return false;
                return true;
            }

            double Score(string mode, ShrinkageData r, double t, double d)
            {
                mode = (mode ?? "").Trim().ToLowerInvariant();
                switch (mode)
                {
                    case "energy":
                        // Approx: lower temperature is primary, lower dwell is secondary.
                        return t + 0.2 * d;

                    case "target":
                        // Minimize distance to target vector; add tiny tie-break for lower process effort.
                        var dl = r.LengthFactor - request.TargetLengthFactor;
                        var dw = r.WidthFactor - request.TargetWidthFactor;
                        var ds = r.SleeveFactor - request.TargetSleeveFactor;
                        return Math.Sqrt(dl * dl + dw * dw + ds * ds) + 0.0001 * t + 0.001 * d;

                    case "throughput":
                    default:
                        // Approx: lower dwell is primary, lower temp is secondary.
                        return d + 0.01 * t;
                }
            }

            // Keep top N candidates by score
            var topN = new List<RecommendCandidate>();

            int stepT = Math.Max(1, request.StepTemperature);
            double stepD = Math.Max(0.1, request.StepDwellTime);

            for (var t = request.StartTemperature; t <= request.EndTemperature; t += stepT)
            {
                for (var d = request.StartDwellTime; d <= request.EndDwellTime + 1e-9; d += stepD)
                {
                    res.EvaluatedPoints++;
                    var dRound = Math.Round(d, 2);
                    var r = _calculator.Calculate(request.MaterialId, t, dRound);
                    if (!IsFeasible(r, t, dRound))
                    {
                        continue;
                    }
                    res.FeasiblePoints++;

                    var s = Score(res.Mode, r, t, dRound);
                    var cand = new RecommendCandidate
                    {
                        Temperature = t,
                        DwellTime = dRound,
                        Score = s,
                        Result = r
                    };

                    // Insert in sorted order
                    var inserted = false;
                    for (int i = 0; i < topN.Count; i++)
                    {
                        if (s < topN[i].Score)
                        {
                            topN.Insert(i, cand);
                            inserted = true;
                            break;
                        }
                    }
                    if (!inserted)
                    {
                        topN.Add(cand);
                    }

                    if (topN.Count > Math.Max(1, request.TopN))
                    {
                        topN.RemoveAt(topN.Count - 1);
                    }
                }
            }

            if (topN.Count > 0)
            {
                topN[0].Label = "Best";
            }
            if (topN.Count > 1)
            {
                topN[1].Label = "Alt 1";
            }
            if (topN.Count > 2)
            {
                topN[2].Label = "Alt 2";
            }

            res.Candidates = topN;
            return Json(res);
        }

        [HttpPost]
        public JsonResult Log(ExperimentEntry entry)
        {
            if (entry == null)
            {
                return Json(new { ok = false });
            }

            if (entry.UnixMs == 0)
            {
                entry.UnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            }

            // cap log size
            if (_experiments.Count >= 200)
            {
                _experiments.RemoveAt(0);
            }

            _experiments.Add(entry);
            return Json(new { ok = true, count = _experiments.Count });
        }

        [HttpGet]
        public JsonResult Experiments()
        {
            return Json(_experiments);
        }
    }
}
