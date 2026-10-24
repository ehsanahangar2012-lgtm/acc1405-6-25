using AshkeGhalam.Windows.Models;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class CompanyWorkspaceServiceTests
{
    [TestMethod]
    public void LegacyDataIsAssignedOnlyToTheCurrentlyActiveCompany()
    {
        var first = new CompanyProfileRecord { Id = "company-a", Name = "شرکت الف", WorkspaceDataJson = "" };
        var second = new CompanyProfileRecord { Id = "company-b", Name = "شرکت ب", WorkspaceDataJson = "" };
        var data = new AccountingData
        {
            ActiveCompanyId = first.Id,
            Companies = [first, second],
            Customers = [new CustomerRecord { Id = "person-a", Name = "مشتری قدیمی" }],
            Products = [new ProductRecord { Id = "product-a", Name = "کالای موجود" }]
        };

        Assert.IsTrue(CompanyWorkspaceService.EnsureInitialized(data));

        var firstWorkspace = CompanyWorkspaceService.DeserializeWorkspace(first.WorkspaceDataJson);
        var secondWorkspace = CompanyWorkspaceService.DeserializeWorkspace(second.WorkspaceDataJson);
        Assert.AreEqual(1, firstWorkspace.Customers.Count);
        Assert.AreEqual("person-a", firstWorkspace.Customers[0].Id);
        Assert.AreEqual(1, firstWorkspace.Products.Count);
        Assert.AreEqual(0, secondWorkspace.Customers.Count);
        Assert.AreEqual(0, secondWorkspace.Products.Count);
        Assert.AreEqual(2, data.Companies.Count, "The company registry must remain global.");
    }

    [TestMethod]
    public void SwitchingCompaniesSavesAndRestoresIndependentOperationalData()
    {
        var first = new CompanyProfileRecord { Id = "company-a", Name = "شرکت الف" };
        var second = new CompanyProfileRecord { Id = "company-b", Name = "شرکت ب" };
        var data = new AccountingData
        {
            ActiveCompanyId = first.Id,
            Companies = [first, second],
            Customers = [new CustomerRecord { Id = "a1", Name = "مشتری شرکت الف" }],
            Products = [new ProductRecord { Id = "p1", Name = "کالای شرکت الف", StockQuantity = 9m }],
            Invoices = [new InvoiceRecord { Id = "i1", CustomerId = "a1", CustomerName = "مشتری شرکت الف", Number = 1, Total = 100m }]
        };

        CompanyWorkspaceService.EnsureInitialized(data);
        Assert.IsTrue(CompanyWorkspaceService.SwitchIfRequested(data, first.Id, second.Id));
        Assert.AreEqual(second.Id, data.ActiveCompanyId);
        Assert.AreEqual(0, data.Customers.Count);
        Assert.AreEqual(0, data.Products.Count);
        Assert.AreEqual(0, data.Invoices.Count);

        data.Customers.Add(new CustomerRecord { Id = "b1", Name = "مشتری شرکت ب" });
        data.Products.Add(new ProductRecord { Id = "p2", Name = "کالای شرکت ب", StockQuantity = 3m });
        data.Invoices.Add(new InvoiceRecord { Id = "i2", CustomerId = "b1", CustomerName = "مشتری شرکت ب", Number = 1, Total = 20m });

        Assert.IsTrue(CompanyWorkspaceService.SwitchIfRequested(data, second.Id, first.Id));
        Assert.AreEqual(first.Id, data.ActiveCompanyId);
        CollectionAssert.AreEqual(new[] { "a1" }, data.Customers.Select(customer => customer.Id).ToArray());
        CollectionAssert.AreEqual(new[] { "p1" }, data.Products.Select(product => product.Id).ToArray());
        CollectionAssert.AreEqual(new[] { "i1" }, data.Invoices.Select(invoice => invoice.Id).ToArray());

        Assert.IsTrue(CompanyWorkspaceService.SwitchIfRequested(data, first.Id, second.Id));
        Assert.AreEqual(second.Id, data.ActiveCompanyId);
        CollectionAssert.AreEqual(new[] { "b1" }, data.Customers.Select(customer => customer.Id).ToArray());
        CollectionAssert.AreEqual(new[] { "p2" }, data.Products.Select(product => product.Id).ToArray());
        CollectionAssert.AreEqual(new[] { "i2" }, data.Invoices.Select(invoice => invoice.Id).ToArray());
        Assert.AreEqual(2, data.Companies.Count);
    }
}
