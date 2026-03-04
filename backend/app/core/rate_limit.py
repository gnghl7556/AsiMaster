"""크롤링 API Rate Limiting 설정 (slowapi 기반)"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# IP 기반 Rate Limiter
limiter = Limiter(key_func=get_remote_address)
