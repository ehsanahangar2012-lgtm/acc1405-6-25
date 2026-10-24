using Microsoft.VisualStudio.TestTools.UnitTesting;
using AshkeGhalam.Windows.Services;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class VoucherMovementPolicyTests
{
    [TestMethod]
    public void MovementChoicesAreFilteredByVoucherType()
    {
        CollectionAssert.AreEquivalent(
            new[] { "GOODS_RECEIPT", "INVENTORY_ADJUSTMENT", "PRODUCTION_OUTPUT" },
            VoucherMovementPolicy.GetAllowedMovementTypes("IN").ToArray());
        CollectionAssert.AreEquivalent(
            new[] { "GOODS_ISSUE", "INVENTORY_ADJUSTMENT", "PRODUCTION_CONSUMPTION" },
            VoucherMovementPolicy.GetAllowedMovementTypes("OUT").ToArray());
        CollectionAssert.AreEquivalent(
            new[] { "RETURN_RECEIPT", "RETURN_ISSUE" },
            VoucherMovementPolicy.GetAllowedMovementTypes("RETURN").ToArray());
    }

    [TestMethod]
    public void DefaultMovementsMatchVoucherTypeAndMismatchesAreRejected()
    {
        Assert.AreEqual("GOODS_RECEIPT", VoucherMovementPolicy.GetDefaultMovementType("IN"));
        Assert.AreEqual("GOODS_ISSUE", VoucherMovementPolicy.GetDefaultMovementType("OUT"));
        Assert.AreEqual("RETURN_RECEIPT", VoucherMovementPolicy.GetDefaultMovementType("RETURN"));

        Assert.IsTrue(VoucherMovementPolicy.IsAllowed("IN", "PRODUCTION_OUTPUT"));
        Assert.IsTrue(VoucherMovementPolicy.IsAllowed("OUT", "PRODUCTION_CONSUMPTION"));
        Assert.IsTrue(VoucherMovementPolicy.IsAllowed("RETURN", "RETURN_ISSUE"));
        Assert.IsFalse(VoucherMovementPolicy.IsAllowed("IN", "GOODS_ISSUE"));
        Assert.IsFalse(VoucherMovementPolicy.IsAllowed("OUT", "RETURN_RECEIPT"));
        Assert.IsFalse(VoucherMovementPolicy.IsAllowed("RETURN", "INVENTORY_ADJUSTMENT"));
        Assert.IsFalse(VoucherMovementPolicy.IsAllowed("UNKNOWN", "GOODS_ISSUE"));
    }
}
