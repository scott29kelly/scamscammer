/**
 * Tests for Login API Route
 */

import { NextRequest } from 'next/server';

// Mock the auth module
const mockValidatePassword = jest.fn();
const mockCreateSession = jest.fn();

jest.mock('../../../../../lib/auth', () => ({
  validatePassword: mockValidatePassword,
  createSession: mockCreateSession,
}));

import { POST } from '../route';

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createRequest(body: object): NextRequest {
    return new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  it('should return 400 when password is missing', async () => {
    const request = createRequest({});
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Password is required');
  });

  it('should return 401 when password is invalid', async () => {
    mockValidatePassword.mockReturnValue(false);

    const request = createRequest({ password: 'wrong-password' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid password');
    expect(mockValidatePassword).toHaveBeenCalledWith('wrong-password');
  });

  it('should return 200 and create session when password is valid', async () => {
    mockValidatePassword.mockReturnValue(true);
    mockCreateSession.mockResolvedValue(undefined);

    const request = createRequest({ password: 'correct-password' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Logged in successfully');
    expect(mockValidatePassword).toHaveBeenCalledWith('correct-password');
    expect(mockCreateSession).toHaveBeenCalled();
  });

  it('should return 500 when session creation fails', async () => {
    mockValidatePassword.mockReturnValue(true);
    mockCreateSession.mockRejectedValue(new Error('Session error'));

    const request = createRequest({ password: 'correct-password' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('An error occurred during login');
  });
});
