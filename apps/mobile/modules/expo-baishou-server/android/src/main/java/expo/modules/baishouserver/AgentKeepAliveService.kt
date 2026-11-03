package expo.modules.baishouserver

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import java.util.Collections
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 保持 AI 思考与流式长连接在后台不被系统冻结的前台服务。
 * 遵循 Android 14+ 前台服务类型规范 (dataSync) 与省电/无操作自动超时保护。
 */
class AgentKeepAliveService : Service() {

    companion object {
        const val CHANNEL_ID = "agent_stream_keepalive"
        const val NOTIFICATION_ID = 20261103
        private const val DEFAULT_AUTO_STOP_TIMEOUT_MS = 10 * 60 * 1000L // 10分钟超时防泄漏

        private const val ACTION_START = "expo.modules.baishouserver.action.START_KEEP_ALIVE"
        private const val ACTION_STOP = "expo.modules.baishouserver.action.STOP_KEEP_ALIVE"

        private const val EXTRA_SESSION_ID = "extra_session_id"
        private const val EXTRA_TITLE = "extra_title"
        private const val EXTRA_CONTENT = "extra_content"

        private val activeSessions = Collections.synchronizedSet(mutableSetOf<String>())
        private val isServiceRunning = AtomicBoolean(false)

        fun start(context: Context, sessionId: String? = null, title: String? = null, content: String? = null) {
            val sId = sessionId?.trim() ?: "default_session"
            activeSessions.add(sId)

            val intent = Intent(context, AgentKeepAliveService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_SESSION_ID, sId)
                if (!title.isNullOrBlank()) putExtra(EXTRA_TITLE, title)
                if (!content.isNullOrBlank()) putExtra(EXTRA_CONTENT, content)
            }

            try {
                ContextCompat.startForegroundService(context, intent)
            } catch (e: Throwable) {
                // 部分极端限制下可能抛出 ForegroundServiceStartNotAllowedException 等异常
                android.util.Log.w("AgentKeepAliveService", "Failed to startForegroundService: ${e.message}")
            }
        }

        fun stop(context: Context, sessionId: String? = null) {
            val sId = sessionId?.trim()
            if (sId != null) {
                activeSessions.remove(sId)
            } else {
                activeSessions.clear()
            }

            // 仍有其他会话在流式中，则不立即关闭前台服务
            if (activeSessions.isNotEmpty()) {
                return
            }

            val intent = Intent(context, AgentKeepAliveService::class.java).apply {
                action = ACTION_STOP
            }

            try {
                context.startService(intent)
            } catch (e: Throwable) {
                android.util.Log.w("AgentKeepAliveService", "Failed to send stop intent: ${e.message}")
            }
        }

        fun isActive(): Boolean {
            return isServiceRunning.get() && activeSessions.isNotEmpty()
        }
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val autoStopRunnable = Runnable {
        android.util.Log.i("AgentKeepAliveService", "Auto stopping keep-alive service due to inactivity timeout")
        activeSessions.clear()
        stopForegroundAndSelf()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureNotificationChannel()
        isServiceRunning.set(true)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action

        if (action == ACTION_STOP) {
            if (activeSessions.isEmpty()) {
                stopForegroundAndSelf()
                return START_NOT_STICKY
            }
        }

        resetTimeoutTimer()

        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "白守正在生成回复..."
        val content = intent?.getStringExtra(EXTRA_CONTENT) ?: "后台运行中，可返回应用查看思考与回复"
        val notification = buildNotification(title, content)

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceCompat.startForeground(
                    this,
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Throwable) {
            android.util.Log.e("AgentKeepAliveService", "startForeground failed: ${e.message}", e)
        }

        return START_NOT_STICKY
    }

    private fun stopForegroundAndSelf() {
        mainHandler.removeCallbacks(autoStopRunnable)
        isServiceRunning.set(false)
        try {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        } catch (e: Throwable) {
            // ignore
        }
        stopSelf()
    }

    private fun resetTimeoutTimer() {
        mainHandler.removeCallbacks(autoStopRunnable)
        mainHandler.postDelayed(autoStopRunnable, DEFAULT_AUTO_STOP_TIMEOUT_MS)
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "AI 思考与生成",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "保持模型在后台持续思考生成，防止系统网络与进程挂起"
                    setShowBadge(false)
                }
                manager.createNotificationChannel(channel)
            }
        }
    }

    private fun buildNotification(title: String, content: String): Notification {
        val smallIconRes = resolveSmallIcon()

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val pendingIntent = if (launchIntent != null) {
            val pFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            PendingIntent.getActivity(this, 0, launchIntent, pFlags)
        } else {
            null
        }

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(smallIconRes)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)

        if (pendingIntent != null) {
            builder.setContentIntent(pendingIntent)
        }

        return builder.build()
    }

    private fun resolveSmallIcon(): Int {
        val iconRes = resources.getIdentifier("notification_icon", "drawable", packageName)
        if (iconRes != 0) return iconRes
        return applicationInfo.icon
    }

    override fun onDestroy() {
        mainHandler.removeCallbacks(autoStopRunnable)
        isServiceRunning.set(false)
        activeSessions.clear()
        super.onDestroy()
    }
}
