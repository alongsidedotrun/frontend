/**
 * Development switch for revisiting onboarding after it has been completed.
 * Keep this `true` while diagnosing the flow. Set it to `false` before release
 * to redirect completed users away from every ordinary `/onboard` route.
 */
export const diagnose_onboarding = true;

export const ONBOARDING_COMPLETE_KEY = "alongside:onboarding-complete";

export function hasCompletedOnboardingIntro() {
  return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true";
}
