"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail,
  Lock,
  User,
  Building2,
  FileCheck,
  MapPin,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export default function SignupPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    brokerage: "",
    licenseNumber: "",
    licenseState: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Placeholder for actual auth
    setTimeout(() => setIsLoading(false), 1500);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-5 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
              <span className="text-lg font-bold text-white">D</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground">
              Dreamhouse
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm">
          <div className="p-8">
            <h1 className="text-center text-xl font-bold text-foreground">
              Create your account
            </h1>
            <p className="mt-2 text-center text-sm text-muted">
              Start finding properties smarter with AI-powered search.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {/* Name */}
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    id="name"
                    type="text"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Jane Smith"
                    required
                    className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/10"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="you@brokerage.com"
                    required
                    className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/10"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    placeholder="Create a strong password"
                    required
                    minLength={8}
                    className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-12 text-sm text-foreground outline-none transition-colors placeholder:text-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Must be at least 8 characters
                </p>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border-light" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs text-muted">
                    License Information
                  </span>
                </div>
              </div>

              {/* Brokerage */}
              <div>
                <label
                  htmlFor="brokerage"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Brokerage
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    id="brokerage"
                    type="text"
                    value={form.brokerage}
                    onChange={(e) => update("brokerage", e.target.value)}
                    placeholder="Compass, Windermere, etc."
                    className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/10"
                  />
                </div>
              </div>

              {/* License number + state row */}
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-3">
                  <label
                    htmlFor="licenseNumber"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    License Number
                  </label>
                  <div className="relative">
                    <FileCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      id="licenseNumber"
                      type="text"
                      value={form.licenseNumber}
                      onChange={(e) => update("licenseNumber", e.target.value)}
                      placeholder="e.g. 12345678"
                      className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/10"
                    />
                  </div>
                </div>

                <div className="col-span-2">
                  <label
                    htmlFor="licenseState"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    State
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <select
                      id="licenseState"
                      value={form.licenseState}
                      onChange={(e) => update("licenseState", e.target.value)}
                      className="w-full appearance-none rounded-xl border border-border bg-white py-3 pl-10 pr-4 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10"
                    >
                      <option value="">Select</option>
                      {US_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </button>

              <p className="text-center text-xs text-muted">
                By signing up, you agree to our Terms of Service and Privacy
                Policy.
              </p>
            </form>
          </div>

          {/* Footer */}
          <div className="border-t border-border-light bg-gray-50 px-8 py-4 text-center">
            <p className="text-sm text-muted">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="font-semibold text-accent hover:text-accent-hover"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
