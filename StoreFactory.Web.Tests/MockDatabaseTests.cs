using StoreFactory.Web.Data;
using Xunit;

namespace StoreFactory.Web.Tests
{
    [Collection("MockDatabaseCollection")]
    public class MockDatabaseTests
    {
        [Fact]
        public void MockDatabase_LoadsMaterialsAndShrinkageParameters()
        {
            Assert.NotEmpty(MockDatabase.Materials);
            Assert.NotEmpty(MockDatabase.ShrinkageParameters);
        }
    }
}