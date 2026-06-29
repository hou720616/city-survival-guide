"""统一日志配置。

提供项目级 logger，同时输出到控制台（彩色）与文件（按天滚动）。
所有模块通过 `from utils.logger import logger` 引用，避免各自配置。

日志文件默认写入 `api/logs/` 目录，可通过环境变量 LOG_DIR 覆盖。
"""

import logging
import os
import sys
from logging.handlers import TimedRotatingFileHandler

# 日志目录：优先读环境变量，默认放在 api/logs/
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_LOG_DIR = os.getenv("LOG_DIR", os.path.join(_BASE_DIR, "logs"))
os.makedirs(_LOG_DIR, exist_ok=True)

_LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG").upper()

# ===== 控制台格式（带颜色，便于开发调试） =====
class _ColorFormatter(logging.Formatter):
    """控制台彩色格式化器。"""

    _COLORS = {
        logging.DEBUG: "\033[36m",     # 青色
        logging.INFO: "\033[32m",      # 绿色
        logging.WARNING: "\033[33m",   # 黄色
        logging.ERROR: "\033[31m",     # 红色
        logging.CRITICAL: "\033[35m",  # 紫色
    }
    _RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        # 保存原始值，格式化后恢复，避免颜色码泄漏到文件 handler
        color = self._COLORS.get(record.levelno, "")
        orig_levelname = record.levelname
        record.levelname = f"{color}{record.levelname:<7}{self._RESET}"
        result = super().format(record)
        record.levelname = orig_levelname
        return result


_CONSOLE_FMT = _ColorFormatter(
    fmt="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
_FILE_FMT = logging.Formatter(
    fmt="%(asctime)s %(levelname)-7s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)


def _build_logger() -> logging.Logger:
    """构建并返回项目根 logger。"""
    log = logging.getLogger("csg")
    log.setLevel(_LOG_LEVEL)
    # 避免重复添加 handler（热重载时可能多次导入）
    if log.handlers:
        return log

    # 控制台输出
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(_LOG_LEVEL)
    console_handler.setFormatter(_CONSOLE_FMT)
    log.addHandler(console_handler)

    # 文件输出：按天滚动，保留 14 天
    file_handler = TimedRotatingFileHandler(
        filename=os.path.join(_LOG_DIR, "app.log"),
        when="midnight",
        backupCount=14,
        encoding="utf-8",
    )
    file_handler.setLevel(_LOG_LEVEL)
    file_handler.setFormatter(_FILE_FMT)
    log.addHandler(file_handler)

    # 防止日志向 root logger 重复传播
    log.propagate = False
    return log


# 全局单例
logger = _build_logger()
