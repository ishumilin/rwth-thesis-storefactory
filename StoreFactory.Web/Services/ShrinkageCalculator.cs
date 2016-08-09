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
            // Simple approach: Filter by Material, then find closest points by Temperature
            var dataPoints = MockDatabase.ShrinkageParameters
                .Where(p => p.MaterialId == materialId)
                .OrderBy(p => p.Temperature)
                .ToList();

            if (!dataPoints.Any())
            {
                // Default no shrinkage
                return new ShrinkageData { LengthFactor = 1, WidthFactor = 1, SleeveFactor = 1 };
            }

            // Exact match?
            var exact = dataPoints.FirstOrDefault(p => p.Temperature == temperature);
            if (exact != null) return exact;

            // Interpolate
            var lower = dataPoints.LastOrDefault(p => p.Temperature < temperature);
            var upper = dataPoints.FirstOrDefault(p => p.Temperature > temperature);

            if (lower == null) return upper; // Too low, clamp to min
            if (upper == null) return lower; // Too high, clamp to max

            // Interpolate Factors
            var result = new ShrinkageData
            {
                ProductId = lower.ProductId,
                MaterialId = materialId,
                Temperature = temperature,
                DwellTime = dwellTime,
                LengthFactor = Interpolate(temperature, lower.Temperature, upper.Temperature, lower.LengthFactor, upper.LengthFactor),
                WidthFactor = Interpolate(temperature, lower.Temperature, upper.Temperature, lower.WidthFactor, upper.WidthFactor),
                SleeveFactor = Interpolate(temperature, lower.Temperature, upper.Temperature, lower.SleeveFactor, upper.SleeveFactor)
            };

            return result;
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
