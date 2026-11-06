/**
 * @format
 */

import 'react-native';
import React from 'react';
import { it, expect, jest } from '@jest/globals';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';

// NavigationContainer + native-stack pull in native bridge APIs
// (react-native-screens) that a jest environment cannot emulate fully.
// For a smoke test we only need to verify that App itself (GameProvider +
// StatusBar + shell) renders and unmounts cleanly.
jest.mock('../src/navigation/AppNavigator', () => {
  // require() here (not the outer React import) — jest.mock factories may
  // only reference whitelisted identifiers.
  const { createElement } = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => createElement(View, { testID: 'app-navigator' }),
  };
});

import App from '../App';

it('renders correctly', async () => {
  let tree: ReactTestRenderer | undefined;
  await act(async () => {
    tree = renderer.create(<App />);
  });
  expect(tree).toBeDefined();
  expect(tree!.toJSON()).toBeTruthy();
  await act(async () => {
    tree!.unmount();
  });
});
