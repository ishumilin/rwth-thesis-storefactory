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

            // Seed Shrinkage Data
            // We intentionally use *synthetic* data here to ensure both Temperature and DwellTime
            // influence the result and the UI looks responsive. We don't aim to match thesis values.
            SeedSyntheticShrinkageGrid(productId: 1, materialId: 1, baseFactor: 1.00, tempSensitivity: -0.0009, dwellSensitivity: -0.006);
            SeedSyntheticShrinkageGrid(productId: 1, materialId: 2, baseFactor: 1.02, tempSensitivity: -0.0004, dwellSensitivity: -0.003);
        }

        private static void SeedSyntheticShrinkageGrid(int productId, int materialId, double baseFactor, double tempSensitivity, double dwellSensitivity)
        {
            // Small 2D grid for bilinear interpolation
            // Temperatures: 30, 100, 150, 200
            // Dwell times: 1, 5, 10, 20
            // Factor formula:
            //   f = base + tempSensitivity*(T-30) + dwellSensitivity*(D-1)
            // Clamp to a reasonable visual range.
            var temps = new[] { 30.0, 100.0, 150.0, 200.0 };
            var dwells = new[] { 1.0, 5.0, 10.0, 20.0 };

            foreach (var t in temps)
            {
                foreach (var d in dwells)
                {
                    var f = baseFactor + tempSensitivity * (t - 30.0) + dwellSensitivity * (d - 1.0);
                    f = Clamp(f, 0.85, 1.10);

                    // Slightly different behavior per dimension to make the sweater visibly change
                    var length = f;
                    var width = Clamp(f + 0.01 * (materialId == 2 ? 1 : -1), 0.85, 1.10);
                    var sleeve = Clamp(f + 0.005 * (dwellSensitivity < 0 ? -1 : 1), 0.85, 1.10);

                    ShrinkageParameters.Add(new ShrinkageData
                    {
                        ProductId = productId,
                        MaterialId = materialId,
                        Temperature = t,
                        DwellTime = d,
                        LengthFactor = length,
                        WidthFactor = width,
                        SleeveFactor = sleeve
                    });
                }
            }
        }

        private static double Clamp(double value, double min, double max)
        {
            if (value < min) return min;
            if (value > max) return max;
            return value;
        }
    }
}
