using System.Collections.Generic;
using StoreFactory.Web.Models;

namespace StoreFactory.Web.Data
{
    public static class MockDatabase
    {
        public static List<Product> Products { get; set; } = new List<Product>();
        public static List<Material> Materials { get; set; } = new List<Material>();
        public static List<ShrinkageData> ShrinkageParameters { get; set; } = new List<ShrinkageData>();

        static MockDatabase()
        {
            // Seed Products
            Products.Add(new Product { Id = 1, Name = "Sweater V-Neck", Description = "Classic V-Neck Sweater" });
            Products.Add(new Product { Id = 2, Name = "Cardigan", Description = "Knitted Cardigan" });
            
            // Seed Materials
            Materials.Add(new Material { Id = 1, Name = "Polyester (PES)", Description = "Synthetic Fiber" });
            Materials.Add(new Material { Id = 2, Name = "Wool", Description = "Natural Fiber" });

            // Seed Shrinkage Data - Polyester (Table 5.1)
            // Series 1: PES Black, 40x40cm
            ShrinkageParameters.Add(new ShrinkageData { ProductId = 1, MaterialId = 1, Temperature = 180, DwellTime = 5.5, LengthFactor = 0.99, WidthFactor = 0.99, SleeveFactor = 0.99 });
            ShrinkageParameters.Add(new ShrinkageData { ProductId = 1, MaterialId = 1, Temperature = 190, DwellTime = 2.5, LengthFactor = 0.98, WidthFactor = 0.98, SleeveFactor = 0.98 });
            ShrinkageParameters.Add(new ShrinkageData { ProductId = 1, MaterialId = 1, Temperature = 195, DwellTime = 1.0, LengthFactor = 0.97, WidthFactor = 0.97, SleeveFactor = 0.97 });
        }
    }
}
