module.exports = {
  overrides: [
    {
      files: ['jest.setup.js', '__tests__/**/*.{js,ts,tsx}'],
      env: { jest: true, node: true },
    },
  ],
  root: true,
  extends: '@react-native',
};
