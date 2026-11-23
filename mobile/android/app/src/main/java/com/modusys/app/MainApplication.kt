package com.modusys.app

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Raleway and Manrope with every weight, so fontWeight picks the real Medium / SemiBold / Bold file (res/font/*.xml).
    ReactFontManager.getInstance().addCustomFont(this, "Raleway", R.font.raleway)
    ReactFontManager.getInstance().addCustomFont(this, "Manrope", R.font.manrope)
    loadReactNative(this)
  }
}
