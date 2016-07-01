using Microsoft.AspNetCore.Mvc;
using StoreFactory.Web.Services;
using StoreFactory.Web.Models;

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
            return View();
        }

        [HttpPost]
        public JsonResult Calculate(int materialId, double temperature, double dwellTime)
        {
            var result = _calculator.Calculate(materialId, temperature, dwellTime);
            return Json(result);
        }
    }
}
