import React from "react";
import { useThemeStore } from "../../stores/useThemeStore";

interface TaxBracketsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TaxBracketsModal: React.FC<TaxBracketsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isDarkMode } = useThemeStore();

  const taxBrackets = [
    { rate: 0.1, range: "0 - 79,560 ₪", monthly: "0 - 6,630 ₪" },
    { rate: 0.14, range: "79,561 - 114,120 ₪", monthly: "6,631 - 9,510 ₪" },
    { rate: 0.2, range: "114,121 - 177,360 ₪", monthly: "9,511 - 14,780 ₪" },
    { rate: 0.31, range: "177,361 - 247,440 ₪", monthly: "14,781 - 20,620 ₪" },
    { rate: 0.35, range: "247,441 - 514,920 ₪", monthly: "20,621 - 42,910 ₪" },
    { rate: 0.47, range: "514,921 - 663,240 ₪", monthly: "42,911 - 55,270 ₪" },
    { rate: 0.5, range: "Above 721,560 ₪", monthly: "Above 60,130 ₪" },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div
        className={`${
          isDarkMode ? "bg-gray-800" : "bg-white"
        } rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden`}
      >
        <div
          className={`flex justify-between items-center p-6 border-b ${
            isDarkMode ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <div className="flex items-center space-x-3">
            <svg
              className={`w-6 h-6 ${
                isDarkMode ? "text-yellow-400" : "text-yellow-600"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
              />
            </svg>
            <h2
              className={`text-xl font-semibold ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}
            >
              Israeli Tax Brackets (2024/2025)
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${
              isDarkMode
                ? "hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            }`}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-auto max-h-[calc(80vh-120px)]">
          <div
            className={`rounded-lg overflow-hidden border ${
              isDarkMode ? "border-gray-700" : "border-gray-200"
            }`}
          >
            <table
              className={`w-full text-sm ${
                isDarkMode ? "bg-gray-800" : "bg-white"
              }`}
            >
              <thead className={isDarkMode ? "bg-gray-700" : "bg-gray-50"}>
                <tr>
                  <th
                    className={`px-6 py-3 text-left ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Tax Rate
                  </th>
                  <th
                    className={`px-6 py-3 text-left ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Annual Income
                  </th>
                  <th
                    className={`px-6 py-3 text-left ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Monthly Income
                  </th>
                </tr>
              </thead>
              <tbody
                className={`divide-y ${
                  isDarkMode ? "divide-gray-700" : "divide-gray-200"
                }`}
              >
                {taxBrackets.map((bracket) => (
                  <tr
                    key={bracket.rate}
                    className={isDarkMode ? "text-gray-300" : "text-gray-600"}
                  >
                    <td className="px-6 py-4 font-medium">
                      {(bracket.rate * 100).toFixed(0)}%
                    </td>
                    <td className="px-6 py-4">{bracket.range}</td>
                    <td className="px-6 py-4">{bracket.monthly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="py-2 text-sm text-gray-500">
            * 50% includes 3% tax on high income
          </p>
        </div>
      </div>
    </div>
  );
};
