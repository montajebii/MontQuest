module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@maplibre|react-native-.*|@notifee|react-native-screens|react-native-safe-area-context|react-native-vector-icons)/)',
  ],
};
