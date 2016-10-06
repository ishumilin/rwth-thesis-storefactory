using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
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

            LoadMeasurementsFromCsv();
        }

        private static void LoadMeasurementsFromCsv()
        {
            // Load real measurement data (used for analysis) into the simulator.
            // CSV columns: material,temperature_c,dwell_min,length_factor,width_factor,sleeve_factor
            var csvPath = ResolveMeasurementsPath();
            if (csvPath == null)
            {
                // No CSV found; leave collections empty to avoid misleading synthetic data.
                return;
            }

            var materialLookup = new Dictionary<string, Material>(StringComparer.OrdinalIgnoreCase);

            using (var stream = File.OpenRead(csvPath))
            using (var reader = new StreamReader(stream))
            {
                var header = reader.ReadLine();
                if (string.IsNullOrWhiteSpace(header))
                {
                    return;
                }

                while (!reader.EndOfStream)
                {
                    var line = reader.ReadLine();
                    if (string.IsNullOrWhiteSpace(line))
                    {
                        continue;
                    }

                    var parts = line.Split(',');
                    if (parts.Length < 6)
                    {
                        continue;
                    }

                    var materialKey = parts[0].Trim();
                    if (!materialLookup.TryGetValue(materialKey, out var material))
                    {
                        material = new Material
                        {
                            Id = Materials.Count + 1,
                            Name = materialKey,
                            Description = "Measured material"
                        };
                        Materials.Add(material);
                        materialLookup[materialKey] = material;
                    }

                    if (!TryParseInvariant(parts[1], out var temperature)) continue;
                    if (!TryParseInvariant(parts[2], out var dwell)) continue;
                    if (!TryParseInvariant(parts[3], out var length)) continue;
                    if (!TryParseInvariant(parts[4], out var width)) continue;
                    if (!TryParseInvariant(parts[5], out var sleeve)) continue;

                    ShrinkageParameters.Add(new ShrinkageData
                    {
                        ProductId = 1,
                        MaterialId = material.Id,
                        Temperature = temperature,
                        DwellTime = dwell,
                        LengthFactor = length,
                        WidthFactor = width,
                        SleeveFactor = sleeve
                    });
                }
            }
        }

        private static string ResolveMeasurementsPath()
        {
            var baseDir = AppContext.BaseDirectory;
            var candidates = new[]
            {
                Path.Combine(baseDir, "wwwroot", "data", "measurements.csv"),
                Path.Combine(baseDir, "data", "measurements.csv"),
                Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "data", "measurements.csv"),
                Path.Combine(Directory.GetCurrentDirectory(), "..", "data", "measurements.csv"),
                Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "data", "measurements.csv")
            };

            foreach (var candidate in candidates)
            {
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }

            return null;
        }

        private static bool TryParseInvariant(string value, out double parsed)
        {
            return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out parsed);
        }
    }
}
