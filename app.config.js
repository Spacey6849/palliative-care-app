export default {
  expo: {
    name: "Palliative Care",
    slug: "palliative-care-app",
    owner: "moses6849",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/palliative care.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/palliative care.png",
      resizeMode: "contain",
      backgroundColor: "#667eea"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.palliativecare.app",
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      }
    },
    scheme: "palliativecare",
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/palliative care.png",
        backgroundColor: "#667eea"
      },
      package: "com.palliativecare.app",
      permissions: [
        "CAMERA",
        "NOTIFICATIONS",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      }
    },
    web: {
      favicon: "./assets/palliative care.png"
    },
    plugins: [
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#667eea",
          sounds: []
        }
      ],
      "expo-font",
      "./plugins/withGoogleServices.js",
      "./plugins/withGoogleMaps.js"
    ],
    extra: {
      eas: {
        projectId: "3e8fe9d4-b515-45e0-ac31-784ab8419b12"
      }
    },
    notification: {
      icon: "./assets/icon.png",
      color: "#667eea",
      androidMode: "default",
      androidCollapsedTitle: "Palliative Care"
    }
  }
};
