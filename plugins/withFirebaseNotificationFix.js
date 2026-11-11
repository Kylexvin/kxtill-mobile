const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withFirebaseNotificationFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const app = manifest.application[0];
    (app['meta-data'] || []).forEach((m) => {
      const name = m.$['android:name'];
      if (
        name === 'com.google.firebase.messaging.default_notification_color' ||
        name === 'com.google.firebase.messaging.default_notification_icon'
      ) {
        m.$['tools:replace'] = 'android:resource';
      }
    });

    return config;
  });
};