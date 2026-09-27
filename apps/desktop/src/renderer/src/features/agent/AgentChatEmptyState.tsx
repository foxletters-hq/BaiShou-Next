import React from 'react'
import { useAgentIdleGreeting } from './utils/agent-idle-greeting'
import styles from './AgentScreen.module.css'
import partnerWelcomeMascot from './assets/partner-welcome.png'

export function AgentChatEmptyState() {
  const idleGreeting = useAgentIdleGreeting()
  return (
    <div className={styles.emptyIdle}>
      <div className={styles.emptyMascot}>
        <img
          src={partnerWelcomeMascot}
          alt=""
          className={styles.emptyMascotImg}
          draggable={false}
        />
      </div>
      <p className={styles.emptyGreeting}>{idleGreeting}</p>
    </div>
  )
}
