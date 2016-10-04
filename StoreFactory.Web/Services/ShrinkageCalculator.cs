using System;
using System.Linq;
using StoreFactory.Web.Data;
using StoreFactory.Web.Models;

namespace StoreFactory.Web.Services
{
    public class ShrinkageCalculator : IShrinkageCalculator
    {
        public ShrinkageData Calculate(int materialId, double temperature, double dwellTime)
        {
            // 2D approach: interpolate in (Temperature, DwellTime) space.
            // We always return a *new* ShrinkageData instance.
            var dataPoints = MockDatabase.ShrinkageParameters
                .Where(p => p.MaterialId == materialId)
                .ToList();

            if (!dataPoints.Any())
            {
                // Default no shrinkage
                return new ShrinkageData
                {
                    ProductId = 0,
                    MaterialId = materialId,
                    Temperature = temperature,
                    DwellTime = dwellTime,
                    LengthFactor = 1,
                    WidthFactor = 1,
                    SleeveFactor = 1
                };
            }

            // Exact match in 2D?
            var exact = dataPoints.FirstOrDefault(p => p.Temperature == temperature && p.DwellTime == dwellTime);
            if (exact != null)
            {
                return CopyWithInputs(exact, materialId, temperature, dwellTime);
            }

            // Find surrounding T values
            var availableTemps = dataPoints.Select(p => p.Temperature).Distinct().OrderBy(t => t).ToList();
            var t0 = availableTemps.LastOrDefault(t => t <= temperature);
            var t1 = availableTemps.FirstOrDefault(t => t >= temperature);
            if (t0 == 0 && availableTemps.Count > 0 && availableTemps[0] > temperature) t0 = availableTemps[0];
            if (t1 == 0 && availableTemps.Count > 0 && availableTemps.Last() < temperature) t1 = availableTemps.Last();

            // Find surrounding D values
            var availableDwells = dataPoints.Select(p => p.DwellTime).Distinct().OrderBy(d => d).ToList();
            var d0 = availableDwells.LastOrDefault(d => d <= dwellTime);
            var d1 = availableDwells.FirstOrDefault(d => d >= dwellTime);
            if (d0 == 0 && availableDwells.Count > 0 && availableDwells[0] > dwellTime) d0 = availableDwells[0];
            if (d1 == 0 && availableDwells.Count > 0 && availableDwells.Last() < dwellTime) d1 = availableDwells.Last();

            // Get corners (may be missing for sparse datasets)
            var q11 = dataPoints.FirstOrDefault(p => p.Temperature == t0 && p.DwellTime == d0);
            var q21 = dataPoints.FirstOrDefault(p => p.Temperature == t1 && p.DwellTime == d0);
            var q12 = dataPoints.FirstOrDefault(p => p.Temperature == t0 && p.DwellTime == d1);
            var q22 = dataPoints.FirstOrDefault(p => p.Temperature == t1 && p.DwellTime == d1);

            // Fallbacks
            // If we have a full rectangle -> bilinear.
            // If we only have one dimension -> 1D interpolate.
            // Else -> nearest neighbor.
            if (q11 != null && q21 != null && q12 != null && q22 != null)
            {
                var interp = Bilinear(temperature, dwellTime, q11, q21, q12, q22);
                interp.MaterialId = materialId;
                interp.Temperature = temperature;
                interp.DwellTime = dwellTime;
                return interp;
            }

            // 1D: fix dwell (d0) and interpolate over temperature
            if (q11 != null && q21 != null && t0 != t1)
            {
                return new ShrinkageData
                {
                    ProductId = q11.ProductId,
                    MaterialId = materialId,
                    Temperature = temperature,
                    DwellTime = dwellTime,
                    LengthFactor = Interpolate(temperature, t0, t1, q11.LengthFactor, q21.LengthFactor),
                    WidthFactor = Interpolate(temperature, t0, t1, q11.WidthFactor, q21.WidthFactor),
                    SleeveFactor = Interpolate(temperature, t0, t1, q11.SleeveFactor, q21.SleeveFactor)
                };
            }

            // 1D: fix temp (t0) and interpolate over dwell
            if (q11 != null && q12 != null && d0 != d1)
            {
                return new ShrinkageData
                {
                    ProductId = q11.ProductId,
                    MaterialId = materialId,
                    Temperature = temperature,
                    DwellTime = dwellTime,
                    LengthFactor = Interpolate(dwellTime, d0, d1, q11.LengthFactor, q12.LengthFactor),
                    WidthFactor = Interpolate(dwellTime, d0, d1, q11.WidthFactor, q12.WidthFactor),
                    SleeveFactor = Interpolate(dwellTime, d0, d1, q11.SleeveFactor, q12.SleeveFactor)
                };
            }

            var nearest = dataPoints
                .OrderBy(p => DistanceSq(p.Temperature, p.DwellTime, temperature, dwellTime))
                .First();
            return CopyWithInputs(nearest, materialId, temperature, dwellTime);
        }

        private ShrinkageData CopyWithInputs(ShrinkageData source, int materialId, double temperature, double dwellTime)
        {
            return new ShrinkageData
            {
                ProductId = source.ProductId,
                MaterialId = materialId,
                Temperature = temperature,
                DwellTime = dwellTime,
                LengthFactor = source.LengthFactor,
                WidthFactor = source.WidthFactor,
                SleeveFactor = source.SleeveFactor
            };
        }

        private ShrinkageData Bilinear(double t, double d, ShrinkageData q11, ShrinkageData q21, ShrinkageData q12, ShrinkageData q22)
        {
            // q11: (t0,d0), q21: (t1,d0), q12: (t0,d1), q22: (t1,d1)
            var t0 = q11.Temperature;
            var t1 = q21.Temperature;
            var d0 = q11.DwellTime;
            var d1 = q12.DwellTime;

            var tx = (t1 - t0) == 0 ? 0 : (t - t0) / (t1 - t0);
            var dx = (d1 - d0) == 0 ? 0 : (d - d0) / (d1 - d0);

            double Blend(double f11, double f21, double f12, double f22)
            {
                // (1-t)(1-d)f11 + t(1-d)f21 + (1-t)df12 + td f22
                return (1 - tx) * (1 - dx) * f11 + tx * (1 - dx) * f21 + (1 - tx) * dx * f12 + tx * dx * f22;
            }

            return new ShrinkageData
            {
                ProductId = q11.ProductId,
                LengthFactor = Blend(q11.LengthFactor, q21.LengthFactor, q12.LengthFactor, q22.LengthFactor),
                WidthFactor = Blend(q11.WidthFactor, q21.WidthFactor, q12.WidthFactor, q22.WidthFactor),
                SleeveFactor = Blend(q11.SleeveFactor, q21.SleeveFactor, q12.SleeveFactor, q22.SleeveFactor)
            };
        }

        private double DistanceSq(double t0, double d0, double t1, double d1)
        {
            var dt = t0 - t1;
            var dd = d0 - d1;
            return dt * dt + dd * dd;
        }

        private double Interpolate(double x, double x0, double x1, double y0, double y1)
        {
            if ((x1 - x0) == 0)
            {
                return (y0 + y1) / 2;
            }
            return y0 + (x - x0) * (y1 - y0) / (x1 - x0);
        }
    }
}
