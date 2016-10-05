using System;
using Microsoft.AspNetCore.Mvc;

namespace StoreFactory.Web.Controllers
{
    public class HomeController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }

        public IActionResult About()
        {
            ViewData["Message"] = "Master Thesis: StoreFactory Project";
            return View();
        }

        public IActionResult Error()
        {
            return View();
        }
    }
}
