using System.Collections.Generic;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace StoreFactory.Web.Models
{
    public class SimulatorViewModel
    {
        public List<SelectListItem> Materials { get; set; }
        public int SelectedMaterialId { get; set; }
        public double Temperature { get; set; }
        public double DwellTime { get; set; }
        
        public ShrinkageData Result { get; set; }
    }
}
