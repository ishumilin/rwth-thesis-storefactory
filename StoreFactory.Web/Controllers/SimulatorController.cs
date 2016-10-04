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
