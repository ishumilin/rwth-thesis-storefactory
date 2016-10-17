using System;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using StoreFactory.Web.Controllers;
using StoreFactory.Web.Models;
using StoreFactory.Web.Data;
using Xunit;

namespace StoreFactory.Web.Tests
{
    [Collection("MockDatabaseCollection")]
    public class SimulatorControllerTests
    {
        private readonly SimulatorController _controller = new SimulatorController();

        private static int GetMaterialId()
        {
            return MockDatabase.Materials.FirstOrDefault()?.Id ?? 1;
        }

        [Fact]
        public void Calculate_ReturnsShrinkageData()
        {
            var materialId = GetMaterialId();

            var result = _controller.Calculate(materialId, 150, 5) as JsonResult;

            Assert.NotNull(result);
            var payload = Assert.IsType<ShrinkageData>(result.Value);
            Assert.Equal(150, payload.Temperature);
            Assert.Equal(5, payload.DwellTime);
            Assert.True(payload.LengthFactor > 0);
        }

        [Fact]
        public void Curve_ReturnsSeriesForTemperatureRange()
        {
            var request = new CurveRequest
            {
                MaterialId = GetMaterialId(),
                DwellTime = 4,
                StartTemperature = 50,
                EndTemperature = 100,
                Step = 10
            };

            var result = _controller.Curve(request) as JsonResult;

            Assert.NotNull(result);
            var payload = Assert.IsType<CurveResponse>(result.Value);
            Assert.Equal(payload.Temperatures.Count, payload.Length.Count);
            Assert.Equal(6, payload.Temperatures.Count);
            Assert.Equal(50, payload.Temperatures.First());
            Assert.Equal(100, payload.Temperatures.Last());
        }

        [Fact]
        public void Surface_ReturnsGridWithExpectedShape()
        {
            var request = new SurfaceRequest
            {
                MaterialId = GetMaterialId(),
                StartTemperature = 100,
                EndTemperature = 120,
                StepTemperature = 10,
                StartDwellTime = 2,
                EndDwellTime = 4,
                StepDwellTime = 1
            };

            var result = _controller.Surface(request) as JsonResult;

            Assert.NotNull(result);
            var payload = Assert.IsType<SurfaceResponse>(result.Value);
            Assert.Equal(3, payload.Temperatures.Count);
            Assert.Equal(3, payload.DwellTimes.Count);
            Assert.Equal(payload.DwellTimes.Count, payload.Values.Count);
            Assert.All(payload.Values, row => Assert.Equal(payload.Temperatures.Count, row.Count));
        }

        [Fact]
        public void Recommend_ReturnsCandidates()
        {
            var request = new RecommendRequest
            {
                MaterialId = GetMaterialId(),
                Mode = "throughput",
                StartTemperature = 100,
                EndTemperature = 110,
                StepTemperature = 5,
                StartDwellTime = 2,
                EndDwellTime = 4,
                StepDwellTime = 1,
                TopN = 2,
                MinLengthFactor = 0.5,
                MinWidthFactor = 0.5,
                MinSleeveFactor = 0.5
            };

            var result = _controller.Recommend(request) as JsonResult;

            Assert.NotNull(result);
            var payload = Assert.IsType<RecommendResponse>(result.Value);
            Assert.True(payload.EvaluatedPoints > 0);
            Assert.NotNull(payload.Candidates);
            Assert.True(payload.Candidates.Count > 0);
        }
    }
}