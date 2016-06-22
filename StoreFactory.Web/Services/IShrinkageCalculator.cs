using StoreFactory.Web.Models;

namespace StoreFactory.Web.Services
{
    public interface IShrinkageCalculator
    {
        ShrinkageData Calculate(int materialId, double temperature, double dwellTime);
    }
}
