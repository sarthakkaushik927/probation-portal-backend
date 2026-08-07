import { Request, Response } from 'express';
import * as AuthService from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response.util';

export async function signup(req: Request, res: Response) {
  try {
    const { name, email, password } = req.body;

    if (!email || !password) {
      sendError(res, 'Email and password are required', 400);
      return;
    }

    await AuthService.signupUser(name, email, password);
    sendSuccess(res, {}, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signup failed';
    const statusCode = message === 'User already exists' ? 409 : 500;
    sendError(res, message, statusCode);
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      sendError(res, 'Email and password are required', 400);
      return;
    }

    const result = await AuthService.loginUser(email, password);
    sendSuccess(res, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    const statusCode = message === 'UNVERIFIED' ? 403 : 401;
    const displayMessage =
      message === 'UNVERIFIED' ? 'Please verify your email first' : message;
    sendError(res, displayMessage, statusCode);
  }
}

export async function sendOTP(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      sendError(res, 'Email is required', 400);
      return;
    }

    await AuthService.sendOTP(email);
    sendSuccess(res, {});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send OTP';
    sendError(res, message, 500);
  }
}

export async function verifyOTP(req: Request, res: Response) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      sendError(res, 'Email and OTP are required', 400);
      return;
    }

    await AuthService.verifyOTP(email, otp);
    sendSuccess(res, {});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    sendError(res, message, 400);
  }
}

export async function resendOTP(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      sendError(res, 'Email is required', 400);
      return;
    }

    await AuthService.sendOTP(email);
    sendSuccess(res, {});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resend OTP';
    sendError(res, message, 500);
  }
}
