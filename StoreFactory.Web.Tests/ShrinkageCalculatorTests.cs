using System;
using System.Linq;
using Xunit;
using StoreFactory.Web.Services;
using StoreFactory.Web.Models;
using StoreFactory.Web.Data;

namespace StoreFactory.Web.Tests
{
    [Collection("MockDatabaseCollection")]
    public class ShrinkageCalculatorTests
    {
        private readonly ShrinkageCalculator _calculator;

        public ShrinkageCalculatorTests()
        {
            _calculator = new ShrinkageCalculator();
        }

        private static int GetMaterialId()
        {
            return MockDatabase.Materials.FirstOrDefault()?.Id ?? 1;
        }

        private static ILookup<string, ShrinkageData> LookupPoints(int materialId)
        {
            return MockDatabase.ShrinkageParameters
                .Where(p => p.MaterialId == materialId)
                .ToLookup(p => $"{p.Temperature}|{p.DwellTime}");
        }

        [Fact]
        public void Calculate_ReturnsExactMatch_WhenTemperatureExists()
        {
            // Act
            // Synthetic DB has a point for (T=200, D=20) etc.
            // We'll use an exact point from the seeded grid.
            var result = _calculator.Calculate(GetMaterialId(), 200, 20);

            // Assert
            Assert.Equal(200, result.Temperature);
            Assert.Equal(20, result.DwellTime);
            Assert.True(result.LengthFactor > 0);
        }

        [Fact]
        public void Calculate_ExactMatch_DoesNotEchoDatabaseDwellTime_WhenCallerProvidesDifferentDwellTime()
        {
            // Act
            // Exact temperature match exists for multiple dwell times; returned dwell time must match input.
            var result = _calculator.Calculate(GetMaterialId(), 200, 2.5);

            // Assert
            Assert.Equal(200, result.Temperature);
            Assert.Equal(2.5, result.DwellTime);
            Assert.True(result.LengthFactor > 0);
        }

        [Fact]
        public void Calculate_ReturnsDefaults_WhenMaterialNotFound()
        {
            // Act
            var result = _calculator.Calculate(999, 180, 5.5);

            // Assert
            Assert.Equal(1.0, result.LengthFactor);
            Assert.Equal(180, result.Temperature);
            Assert.Equal(5.5, result.DwellTime);
        }

        [Fact]
        public void Calculate_ReturnsInterpolatedValue()
        {
            // Act
            // With the measurement grid, use adjacent temperature points for a stable interpolation check.
            var materialId = GetMaterialId();
            var points = MockDatabase.ShrinkageParameters
                .Where(p => p.MaterialId == materialId)
                .ToList();

            Assert.NotEmpty(points);

            var dwellGroup = points
                .GroupBy(p => p.DwellTime)
                .FirstOrDefault(g => g.Select(p => p.Temperature).Distinct().Count() >= 2);

            Assert.NotNull(dwellGroup);

            var ordered = dwellGroup.OrderBy(p => p.Temperature).ToList();
            var lowPoint = ordered[0];
            var highPoint = ordered[1];

            var midTemp = (lowPoint.Temperature + highPoint.Temperature) / 2.0;
            var low = _calculator.Calculate(materialId, lowPoint.Temperature, lowPoint.DwellTime);
            var mid = _calculator.Calculate(materialId, midTemp, lowPoint.DwellTime);
            var high = _calculator.Calculate(materialId, highPoint.Temperature, lowPoint.DwellTime);

            // Assert
            Assert.True(mid.LengthFactor <= Math.Max(low.LengthFactor, high.LengthFactor));
            Assert.True(mid.LengthFactor >= Math.Min(low.LengthFactor, high.LengthFactor));
            Assert.Equal(midTemp, mid.Temperature);
            Assert.Equal(lowPoint.DwellTime, mid.DwellTime);
        }

        [Fact]
        public void Calculate_ChangesWhenOnlyDwellTimeChanges()
        {
            var materialId = GetMaterialId();
            var a = _calculator.Calculate(materialId, 150, 1);
            var b = _calculator.Calculate(materialId, 150, 20);

            Assert.NotEqual(a.LengthFactor, b.LengthFactor);
        }

        [Fact]
        public void Calculate_UsesBilinearInterpolation_WhenRectangleExists()
        {
            var materialId = GetMaterialId();
            var points = MockDatabase.ShrinkageParameters
                .Where(p => p.MaterialId == materialId)
                .ToList();

            Assert.NotEmpty(points);

            var temps = points.Select(p => p.Temperature).Distinct().OrderBy(t => t).ToList();
            var dwells = points.Select(p => p.DwellTime).Distinct().OrderBy(d => d).ToList();
            var lookup = LookupPoints(materialId);

            ShrinkageData q11 = null, q21 = null, q12 = null, q22 = null;
            double t0 = 0, t1 = 0, d0 = 0, d1 = 0;

            for (var ti = 0; ti < temps.Count - 1 && q11 == null; ti++)
            {
                for (var di = 0; di < dwells.Count - 1 && q11 == null; di++)
                {
                    t0 = temps[ti];
                    t1 = temps[ti + 1];
                    d0 = dwells[di];
                    d1 = dwells[di + 1];

                    q11 = lookup[$"{t0}|{d0}"].FirstOrDefault();
                    q21 = lookup[$"{t1}|{d0}"].FirstOrDefault();
                    q12 = lookup[$"{t0}|{d1}"].FirstOrDefault();
                    q22 = lookup[$"{t1}|{d1}"].FirstOrDefault();

                    if (q11 == null || q21 == null || q12 == null || q22 == null)
                    {
                        q11 = null;
                        q21 = null;
                        q12 = null;
                        q22 = null;
                    }
                }
            }

            Assert.NotNull(q11);

            var tMid = (t0 + t1) / 2.0;
            var dMid = (d0 + d1) / 2.0;

            double Blend(double f11, double f21, double f12, double f22)
            {
                var tx = (t1 - t0) == 0 ? 0 : (tMid - t0) / (t1 - t0);
                var dx = (d1 - d0) == 0 ? 0 : (dMid - d0) / (d1 - d0);
                return (1 - tx) * (1 - dx) * f11 + tx * (1 - dx) * f21 + (1 - tx) * dx * f12 + tx * dx * f22;
            }

            var expectedLength = Blend(q11.LengthFactor, q21.LengthFactor, q12.LengthFactor, q22.LengthFactor);

            var result = _calculator.Calculate(materialId, tMid, dMid);

            Assert.Equal(tMid, result.Temperature);
            Assert.Equal(dMid, result.DwellTime);
            Assert.InRange(result.LengthFactor, expectedLength - 0.0001, expectedLength + 0.0001);
        }

        [Fact]
        public void Calculate_UsesLinearInterpolation_WhenOnlyDwellTimeChanges()
        {
            var materialId = GetMaterialId();
            var points = MockDatabase.ShrinkageParameters
                .Where(p => p.MaterialId == materialId)
                .ToList();

            Assert.NotEmpty(points);

            var tempGroup = points
                .GroupBy(p => p.Temperature)
                .FirstOrDefault(g => g.Select(p => p.DwellTime).Distinct().Count() >= 2);

            Assert.NotNull(tempGroup);

            var ordered = tempGroup.OrderBy(p => p.DwellTime).ToList();
            var low = ordered.First();
            var high = ordered.Last();

            var dMid = (low.DwellTime + high.DwellTime) / 2.0;
            var expected = low.LengthFactor + (dMid - low.DwellTime) * (high.LengthFactor - low.LengthFactor) / (high.DwellTime - low.DwellTime);

            var result = _calculator.Calculate(materialId, low.Temperature, dMid);

            var epsilon = 0.002;
            Assert.InRange(result.LengthFactor, expected - epsilon, expected + epsilon);
            Assert.Equal(low.Temperature, result.Temperature);
            Assert.Equal(dMid, result.DwellTime);
        }

        [Fact]
        public void Calculate_FallsBackToNearestNeighbor_WhenOutsideGrid()
        {
            var materialId = GetMaterialId();
            var points = MockDatabase.ShrinkageParameters
                .Where(p => p.MaterialId == materialId)
                .ToList();

            Assert.NotEmpty(points);

            var minTemp = points.Min(p => p.Temperature);
            var minDwell = points.Min(p => p.DwellTime);
            var queryTemp = minTemp - 25;
            var queryDwell = minDwell - 5;

            var nearest = points
                .OrderBy(p => Math.Pow(p.Temperature - queryTemp, 2) + Math.Pow(p.DwellTime - queryDwell, 2))
                .First();

            var result = _calculator.Calculate(materialId, queryTemp, queryDwell);

            Assert.Equal(queryTemp, result.Temperature);
            Assert.Equal(queryDwell, result.DwellTime);
            Assert.Equal(nearest.LengthFactor, result.LengthFactor, 4);
            Assert.Equal(nearest.WidthFactor, result.WidthFactor, 4);
            Assert.Equal(nearest.SleeveFactor, result.SleeveFactor, 4);
        }
    }
}
