"use client";
export const PrintButton = ({ label = "Drucken" }: { label?: string }) => <button type="button" onClick={() => window.print()} className="btn-light print:hidden">🖨 {label}</button>;
