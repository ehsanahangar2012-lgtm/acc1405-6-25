# Keep Capacitor's JavaScript bridge contracts while allowing R8 to shrink the rest.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keep class com.getcapacitor.** { *; }
-keep class ir.ashkghalam.acc.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-dontwarn com.getcapacitor.**
