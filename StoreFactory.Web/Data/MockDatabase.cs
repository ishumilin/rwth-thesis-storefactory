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
        }
    }
}
