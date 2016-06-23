using System;
using System.Linq;
using StoreFactory.Web.Data;
using StoreFactory.Web.Models;

namespace StoreFactory.Web.Services
{
    public class ShrinkageCalculator : IShrinkageCalculator
    {
        public ShrinkageData Calculate(int materialId, double temperature, double dwellTime)
        {
            throw new NotImplementedException();
        }

        private double Interpolate(double x, double x0, double x1, double y0, double y1)
        {
            if ((x1 - x0) == 0)
            {
                return (y0 + y1) / 2;
            }
            return y0 + (x - x0) * (y1 - y0) / (x1 - x0);
        }
    }
}
