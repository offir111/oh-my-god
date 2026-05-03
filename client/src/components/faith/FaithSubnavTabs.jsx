import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageOverviewLink from '../ui/PageOverviewLink.jsx';

export const FAITH_TABS = [
  { id: 'chat', label: 'צ׳אט' },
  { id: 'rabbi', label: 'שאלת רב' },
  { id: 'bible', label: 'התנ״ך' },
  { id: 'ads', label: 'מפרסמים' },
  { id: 'more', label: 'נוסף' },
];

/**
 * @param {{ activeTab: string; onTabPick?: (id: string) => void }} props
 */
export function FaithSubnavTabs({ activeTab, onTabPick }) {
  const navigate = useNavigate();

  return (
    <div className="faith-cats-wrap">
      <div className="faith-cats-toolbar">
        <div className="faith-cats" role="tablist" aria-label="מדורי דף דת ואמונה">
          {FAITH_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`faith-cat-btn${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => {
                if (tab.id === 'ads') {
                  navigate('/faith/mefarsim');
                  return;
                }
                navigate(`/faith#${tab.id}`);
                onTabPick?.(tab.id);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <PageOverviewLink className="faith-cats-overview-link" />
      </div>
    </div>
  );
}
