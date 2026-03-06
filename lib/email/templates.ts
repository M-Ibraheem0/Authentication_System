export function verifyEmailTemplate(otp: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Verify your email</h2>
      <p>Your verification code is:</p>
      <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; 
                  padding: 20px; background: #f4f4f4; text-align: center; 
                  border-radius: 8px;">
        ${otp}
      </div>
      <p style="color: #666; font-size: 14px;">
        This code expires in 10 minutes. Do not share it with anyone.
      </p>
    </div>
  `;
}

export function forgotPasswordTemplate(resetUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Reset your password</h2>
      <p>Click the button below to reset your password. 
         This link expires in 15 minutes.</p>
      <a href="${resetUrl}" 
         style="display: inline-block; padding: 12px 24px; 
                background: #000; color: #fff; text-decoration: none; 
                border-radius: 6px; margin: 16px 0;">
        Reset Password
      </a>
      <p style="color: #666; font-size: 14px;">
        If you didn't request this, ignore this email. 
        Your password won't change.
      </p>
    </div>
  `;
}

