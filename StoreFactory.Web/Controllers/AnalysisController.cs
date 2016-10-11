using Microsoft.AspNetCore.Mvc;

namespace StoreFactory.Web.Controllers
{
    // Analysis is precomputed (via Python scripts) and served as static JSON under wwwroot/data.
    // These actions only serve Razor views that render those charts.
    public class AnalysisController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Analysis";
            return View();
        }

        public IActionResult Performance()
        {
            ViewData["Title"] = "Performance Analysis";
            return View();
        }
    }
}
