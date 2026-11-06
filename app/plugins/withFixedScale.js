const { withMainActivity } = require('@expo/config-plugins');

module.exports = (config) =>
  withMainActivity(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (src.includes('attachBaseContext')) return cfg;
    cfg.modResults.contents = src.replace(
      'class MainActivity : ReactActivity() {',
      `class MainActivity : ReactActivity() {
  override fun attachBaseContext(newBase: android.content.Context) {
    val config = android.content.res.Configuration(newBase.resources.configuration)
    config.fontScale = 1.0f
    config.densityDpi = android.util.DisplayMetrics.DENSITY_DEVICE_STABLE
    super.attachBaseContext(newBase.createConfigurationContext(config))
  }
`
    );
    return cfg;
  });