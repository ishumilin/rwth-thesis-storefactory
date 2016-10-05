namespace StoreFactory.Web.Models
{
    public class ShrinkageData
    {
        public int ProductId { get; set; }
        public int MaterialId { get; set; }
        
        // Factors for different parts (Chapter 5)
        public double LengthFactor { get; set; }
        public double WidthFactor { get; set; }
        public double SleeveFactor { get; set; }
        
        // Process Parameters
        public double Temperature { get; set; }
        public double DwellTime { get; set; }
    }
}
