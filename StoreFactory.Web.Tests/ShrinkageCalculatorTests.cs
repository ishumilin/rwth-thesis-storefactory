using System;
using Xunit;
using StoreFactory.Web.Services;
using StoreFactory.Web.Models;

namespace StoreFactory.Web.Tests
{
    public class ShrinkageCalculatorTests
    {
        private readonly ShrinkageCalculator _calculator;

        public ShrinkageCalculatorTests()
        {
            _calculator = new ShrinkageCalculator();
        }

        [Fact]
        public void Calculate_ReturnsExactMatch_WhenTemperatureExists()
        {
            // Act
            // Synthetic DB has a point for (T=200, D=20) etc.
            // We'll use an exact point from the seeded grid.
            var result = _calculator.Calculate(1, 200, 20);

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
            var result = _calculator.Calculate(1, 200, 2.5);

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
            // With the synthetic grid, we can verify interpolation in temperature.
            // Expect the mid-point to be between the two endpoints.
            var low = _calculator.Calculate(1, 100, 10);
            var mid = _calculator.Calculate(1, 125, 10);
            var high = _calculator.Calculate(1, 150, 10);

            // Assert
            Assert.True(mid.LengthFactor <= Math.Max(low.LengthFactor, high.LengthFactor));
            Assert.True(mid.LengthFactor >= Math.Min(low.LengthFactor, high.LengthFactor));
            Assert.Equal(125, mid.Temperature);
            Assert.Equal(10, mid.DwellTime);
        }

        [Fact]
        public void Calculate_ChangesWhenOnlyDwellTimeChanges()
        {
            var a = _calculator.Calculate(1, 150, 1);
            var b = _calculator.Calculate(1, 150, 20);

            Assert.NotEqual(a.LengthFactor, b.LengthFactor);
        }
    }
}
