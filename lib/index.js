'use strict';

// When started with plain `node app.js`, hand over to the host before anything else runs.
require('./launch').relaunchIfNeeded();

const views = require('./view');
const { state, State, Binding } = require('./state');
const { App } = require('./runtime');
const { system } = require('./system');

module.exports = {
  App,
  state,
  State,
  Binding,
  system,
  View: views.View,
  VStack: views.VStack,
  HStack: views.HStack,
  ZStack: views.ZStack,
  ScrollView: views.ScrollView,
  Card: views.Card,
  Spacer: views.Spacer,
  Icon: views.Icon,
  Divider: views.Divider,
  Text: views.Text,
  Button: views.Button,
  TextField: views.TextField,
  SecureField: views.SecureField,
  TextEditor: views.TextEditor,
  Toggle: views.Toggle,
  Checkbox: views.Checkbox,
  Slider: views.Slider,
  Stepper: views.Stepper,
  Picker: views.Picker,
  ProgressView: views.ProgressView,
  Spinner: views.Spinner,
  Image: views.Image,
  List: views.List,
  ForEach: views.ForEach,
  Native: views.Native,
};
