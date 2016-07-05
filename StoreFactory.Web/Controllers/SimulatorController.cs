using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using StoreFactory.Web.Services;
using StoreFactory.Web.Models;
using StoreFactory.Web.Data;

namespace StoreFactory.Web.Controllers
{
    public class SimulatorController : Controller
    {
        private readonly IShrinkageCalculator _calculator;

        public SimulatorController()
        {
            // In a real app, we would use DI, but for simplicity here we instantiate directly
            // or assume it's injected if we configured Startup.cs properly.
            _calculator = new ShrinkageCalculator();
        }

        public IActionResult Index()
        {
            var model = new SimulatorViewModel
            {
                Materials = MockDatabase.Materials.Select(m => new SelectListItem
                {
                    Value = m.Id.ToString(),
                    Text = m.Name
                }).ToList(),
                Temperature = 180,
                DwellTime = 2.5
            };
            return View(model);
        }

        [HttpPost]
        public JsonResult Calculate(int materialId, double temperature, double dwellTime)
        {
            var result = _calculator.Calculate(materialId, temperature, dwellTime);
            return Json(result);
        }
    }
}
