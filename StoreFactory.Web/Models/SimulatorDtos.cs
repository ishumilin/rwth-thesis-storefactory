using System.Collections.Generic;

namespace StoreFactory.Web.Models
{
    public class CurveRequest
    {
        public int MaterialId { get; set; }
        public double DwellTime { get; set; }
        public int StartTemperature { get; set; } = 30;
        public int EndTemperature { get; set; } = 200;
        public int Step { get; set; } = 10;
    }

    public class CurveResponse
    {
        public List<int> Temperatures { get; set; } = new List<int>();
        public List<double> Length { get; set; } = new List<double>();
        public List<double> Width { get; set; } = new List<double>();
        public List<double> Sleeve { get; set; } = new List<double>();
    }

    public class SurfaceRequest
    {
        public int MaterialId { get; set; }
        public int StartTemperature { get; set; } = 30;
        public int EndTemperature { get; set; } = 200;
        public int StepTemperature { get; set; } = 10;

        public double StartDwellTime { get; set; } = 1;
        public double EndDwellTime { get; set; } = 20;
        public double StepDwellTime { get; set; } = 1;

        // Which factor to visualize in the contour plot
        public string Factor { get; set; } = "length"; // length|width|sleeve
    }

    public class SurfaceResponse
    {
        public List<int> Temperatures { get; set; } = new List<int>();
        public List<double> DwellTimes { get; set; } = new List<double>();

        // Values[dIndex][tIndex]
        public List<List<double>> Values { get; set; } = new List<List<double>>();
    }

    public class OptimizeRequest
    {
        public int MaterialId { get; set; }

        // Desired target for selected factor
        public string Factor { get; set; } = "length";
        public double Target { get; set; } = 0.92;

        public int StartTemperature { get; set; } = 30;
        public int EndTemperature { get; set; } = 200;
        public int StepTemperature { get; set; } = 5;

        public double StartDwellTime { get; set; } = 1;
        public double EndDwellTime { get; set; } = 20;
        public double StepDwellTime { get; set; } = 0.5;
    }

    public class OptimizeResponse
    {
        public double Temperature { get; set; }
        public double DwellTime { get; set; }
        public double Score { get; set; }
        public ShrinkageData Result { get; set; }
    }

    public class ExperimentEntry
    {
        public long UnixMs { get; set; }
        public int MaterialId { get; set; }
        public double Temperature { get; set; }
        public double DwellTime { get; set; }
        public double LengthFactor { get; set; }
        public double WidthFactor { get; set; }
        public double SleeveFactor { get; set; }
        public string Note { get; set; }
    }
}
