using System;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using AshkeGhalam.Windows.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace AshkeGhalam.Windows.Tests;

[TestClass]
public sealed class NumericTextBoxFormatterTests
{
    [TestMethod]
    public void NumericLabelsEnableLiveFormattingButIdentifiersRemainUntouched()
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                var amount = new TextBox { HorizontalContentAlignment = HorizontalAlignment.Center };
                var telephone = new TextBox { HorizontalContentAlignment = HorizontalAlignment.Center };
                var stock = new TextBox { HorizontalContentAlignment = HorizontalAlignment.Center };
                var root = new StackPanel();

                root.Children.Add(new TextBlock { Text = "مبلغ فاکتور" });
                root.Children.Add(amount);
                root.Children.Add(new TextBlock { Text = "شماره تماس" });
                root.Children.Add(telephone);
                root.Children.Add(new TextBlock { Text = "موجودی فعلی" });
                var stockRow = new DockPanel();
                stockRow.Children.Add(stock);
                root.Children.Add(stockRow);

                NumericTextBoxFormatter.AttachNumericFieldsByLabels(root);

                Assert.AreEqual(HorizontalAlignment.Right, amount.HorizontalContentAlignment);
                Assert.AreEqual(FlowDirection.LeftToRight, amount.FlowDirection);
                Assert.AreEqual(HorizontalAlignment.Right, stock.HorizontalContentAlignment);
                Assert.AreEqual(HorizontalAlignment.Center, telephone.HorizontalContentAlignment,
                    "Telephone fields are identifiers, not financial quantities, and must not receive number grouping.");
            }
            catch (Exception ex)
            {
                failure = ex;
            }
        });

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (failure is not null)
            throw new AssertFailedException($"Automatic numeric-field enhancement failed on an STA thread: {failure}", failure);
    }
}
