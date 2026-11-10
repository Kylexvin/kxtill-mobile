// src/navigation/helpers.js
//
// Deep-navigation helpers that keep the Business tab's stack anchored at
// BranchesScreen. Without this, arc actions and dashboard quick actions
// push a deep screen directly into the tab, leaving back with no parent
// to return to.

import { CommonActions } from '@react-navigation/native';
import { ROUTES } from '../constants/routes';

/**
 * Navigate to a screen inside TAB_BUSINESS, guaranteeing that
 * BranchesScreen sits at the bottom of that tab's stack.
 *
 * Pass either `navigationRef.dispatch` (from outside the tab tree) or
 * `navigation.dispatch` (from inside).
 */
export function goToBusinessScreen(dispatch, screen, params = {}) {
  dispatch((state) => {
    const tabRoute = state.routes.find((r) => r.name === ROUTES.TAB_BUSINESS);
    const stackRoutes = tabRoute?.state?.routes || [];
    const rootIsBranches = stackRoutes[0]?.name === ROUTES.BRANCHES_LIST;

    if (rootIsBranches) {
      // BranchesScreen is already the root — push on top normally.
      return CommonActions.navigate(ROUTES.TAB_BUSINESS, {
        screen,
        params,
      });
    }

    // No BranchesScreen beneath — reset the stack to
    // [BranchesScreen, target] so back has a defined destination.
    return CommonActions.navigate(ROUTES.TAB_BUSINESS, {
      state: {
        routes: [
          { name: ROUTES.BRANCHES_LIST },
          { name: screen, params },
        ],
        index: 1,
      },
    });
  });
}