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
            // (Mock DB has 180C -> 0.99 for Material 1)
            var result = _calculator.Calculate(1, 180, 5.5);

            // Assert
            Assert.Equal(0.99, result.LengthFactor);
        }

        [Fact]
        public void Calculate_ReturnsDefaults_WhenMaterialNotFound()
        {
            // Act
            var result = _calculator.Calculate(999, 180, 5.5);

            // Assert
            Assert.Equal(1.0, result.LengthFactor);
        }
    }
}
