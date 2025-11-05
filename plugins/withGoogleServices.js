const { withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withGoogleServices(config) {
  return withAndroidManifest(config, async (config) => {
    const googleServicesPath = path.join(
      config.modRequest.projectRoot,
      'android',
      'app',
      'google-services.json'
    );

    // Get Firebase config from environment or use defaults
    const projectNumber = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_NUMBER || "345963386798";
    const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "palliativecare-e9f97";
    const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "palliativecare-e9f97.firebasestorage.app";
    const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:345963386798:android:10ff7402027ee786091a3f";
    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyCyAxQ6MmWK-B-I9ZqoGwl-wk1vstNd56g";

    const googleServicesContent = {
      project_info: {
        project_number: projectNumber,
        project_id: projectId,
        storage_bucket: storageBucket
      },
      client: [
        {
          client_info: {
            mobilesdk_app_id: appId,
            android_client_info: {
              package_name: "com.palliativecare.app"
            }
          },
          oauth_client: [
            {
              client_id: `${projectNumber}-${Math.random().toString(36).substring(7)}.apps.googleusercontent.com`,
              client_type: 3
            }
          ],
          api_key: [
            {
              current_key: apiKey
            }
          ],
          services: {
            appinvite_service: {
              other_platform_oauth_client: [
                {
                  client_id: `${projectNumber}-${Math.random().toString(36).substring(7)}.apps.googleusercontent.com`,
                  client_type: 3
                }
              ]
            }
          }
        }
      ],
      configuration_version: "1"
    };

    // Ensure directory exists
    const dir = path.dirname(googleServicesPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write the file
    fs.writeFileSync(
      googleServicesPath,
      JSON.stringify(googleServicesContent, null, 2)
    );

    console.log('✅ Generated google-services.json from environment variables');
    console.log(`   Project ID: ${projectId}`);
    console.log(`   App ID: ${appId}`);
    console.log(`   Path: ${googleServicesPath}`);

    return config;
  });
};
