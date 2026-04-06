jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: (path) => {
    if (path.endsWith('roles.yaml')) {
      return 'default: "Default role"';
    }
    if (path.endsWith('models.json')) {
      return '{"default": "default-model"}';
    }
    return jest.requireActual('fs').readFileSync(path);
  },
}));

const { sendSplitMessages } = require('../utils');

describe('sendSplitMessages', () => {
  let channel;

  beforeEach(() => {
    channel = {
      send: jest.fn(),
    };
  });

  test('should not send anything for an empty message', () => {
    sendSplitMessages(channel, '');
    expect(channel.send).not.toHaveBeenCalled();
  });

  test('should send a single message if it is under the limit', () => {
    const message = 'This is a short message.';
    sendSplitMessages(channel, message);
    expect(channel.send).toHaveBeenCalledWith(message);
    expect(channel.send).toHaveBeenCalledTimes(1);
  });

  test('should split a long message into multiple parts', () => {
    const longMessage = 'a'.repeat(2500);
    sendSplitMessages(channel, longMessage);
    expect(channel.send).toHaveBeenCalledTimes(2);
    expect(channel.send.mock.calls[0][0].length).toBe(2000);
    expect(channel.send.mock.calls[1][0].length).toBe(500);
  });

  test('should split a message with newlines correctly', () => {
    const messageWithNewlines = 'Line 1\n' + 'a'.repeat(1990) + '\nLine 3';
    sendSplitMessages(channel, messageWithNewlines);
    expect(channel.send).toHaveBeenCalledTimes(2);
    expect(channel.send.mock.calls[0][0]).toBe('Line 1\n' + 'a'.repeat(1990));
    expect(channel.send.mock.calls[1][0]).toBe('Line 3');
  });
});
