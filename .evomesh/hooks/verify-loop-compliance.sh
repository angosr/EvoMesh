#!/bin/bash
# EvoMesh Compliance Hook — Stop event
# Blocks Claude from finishing if mandatory loop outputs are missing.
# Exit 0 = allow stop, Exit 2 = block stop (force Claude to continue)

ROLE_NAME="${ROLE_NAME:-}"
if [ -z "$ROLE_NAME" ]; then
  exit 0  # Not in a role container, skip
fi

ROLE_DIR=".evomesh/roles/${ROLE_NAME}"
VIOLATIONS=""

# Check 1: short-term.md modified in last 5 minutes
if [ -f "${ROLE_DIR}/memory/short-term.md" ]; then
  if [ -z "$(find "${ROLE_DIR}/memory/short-term.md" -mmin -5 2>/dev/null)" ]; then
    VIOLATIONS="${VIOLATIONS}\n- memory/short-term.md was NOT updated this loop"
  fi
else
  VIOLATIONS="${VIOLATIONS}\n- memory/short-term.md does not exist — create and write it"
fi

# Check 2: metrics.log modified in last 5 minutes
if [ -f "${ROLE_DIR}/metrics.log" ]; then
  if [ -z "$(find "${ROLE_DIR}/metrics.log" -mmin -5 2>/dev/null)" ]; then
    VIOLATIONS="${VIOLATIONS}\n- metrics.log was NOT appended this loop"
  fi
else
  VIOLATIONS="${VIOLATIONS}\n- metrics.log does not exist — create with header: timestamp,loop_duration_s,tasks_completed,errors,inbox_processed"
fi

# If violations found, block stop
if [ -n "$VIOLATIONS" ]; then
  echo -e "COMPLIANCE VIOLATION — you must complete these before finishing:${VIOLATIONS}" >&2
  echo -e "\nWrite memory/short-term.md with Done/Blockers/In-progress/Next focus." >&2
  echo -e "Append one CSV line to metrics.log: timestamp,duration_s,tasks,errors,inbox" >&2
  exit 2
fi

exit 0
