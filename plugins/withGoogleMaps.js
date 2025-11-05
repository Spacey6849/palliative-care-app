const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withGoogleMaps(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];

    // Get Google Maps API key from environment
    const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyAqj9edndGUc1nsdTpdFjVKSnlcBfKry4M';

    // Add Google Maps meta-data
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    // Remove existing Google Maps API key if present
    application['meta-data'] = application['meta-data'].filter(
      (item) => item.$['android:name'] !== 'com.google.android.geo.API_KEY'
    );

    // Add Google Maps API key
    application['meta-data'].push({
      $: {
        'android:name': 'com.google.android.geo.API_KEY',
        'android:value': googleMapsApiKey,
      },
    });

    console.log('✅ Configured Google Maps API key for Android');
    console.log(`   API Key: ${googleMapsApiKey.substring(0, 20)}...`);

    return config;
  });
};
