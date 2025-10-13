window.showMessage = function (text, type = 'success', duration = 5000) {
  const box = document.getElementById('messageBox');
  box.textContent = text;
  box.style.backgroundColor = type === 'success' ? '#2e7d32' :
                              type === 'error'   ? '#c62828' :
                              '#333';
  box.style.display = 'block';
  setTimeout(() => {
    box.style.top = '60px';
    box.style.opacity = '1';
  }, 10);

  clearTimeout(window.__messageBoxTimer);
  window.__messageBoxTimer = setTimeout(() => {
    box.style.top = '-80px';
    box.style.opacity = '0';
    setTimeout(() => {
      box.style.display = 'none';
    }, 400);
  }, duration);
};
window.disableButtonsWithText = function (text) { 
  document.querySelectorAll('.purchase-energy-btn').forEach(btn => {
    if (!btn.dataset.originalText) {
      btn.dataset.originalText = btn.innerHTML;
    }
    btn.innerHTML = text;
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
  });

  // 禁用输入框
  ['from-amount', 'to-amount'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.disabled = true;
      input.classList.add('opacity-50', 'cursor-not-allowed');
    }
  });
};
window.enableButtonsAndRestoreText = function () {
  document.querySelectorAll('.purchase-energy-btn').forEach(btn => {
    if (btn.dataset.originalText) {
      btn.innerHTML = btn.dataset.originalText;
      delete btn.dataset.originalText;
    }
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
  });

  // 启用输入框
  ['from-amount', 'to-amount'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.disabled = false;
      input.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  });
};

function openWalletModal() {
  const modal = document.getElementById('walletModal');
  const content = document.getElementById('walletContent');
  modal.style.display = 'block';
  content.classList.remove('wallet-slide-out');
  content.classList.add('wallet-slide-in');
}

function closeWalletModal() {
  const modal = document.getElementById('walletModal');
  const content = document.getElementById('walletContent');
  content.classList.remove('wallet-slide-in');
  content.classList.add('wallet-slide-out');

  // 动画结束后再隐藏
  content.addEventListener('animationend', () => {
    if (content.classList.contains('wallet-slide-out')) {
      modal.style.display = 'none';
    }
  }, { once: true });
}


window.openConfirmModal = function () {
  const modal = document.getElementById("confirmModal");
  if (modal) modal.style.display = "block";
  disableButtonsWithText(translations[currentLang].loadingText);

};

window.closeConfirmModal = function () {
  const modal = document.getElementById("confirmModal");
  if (modal) modal.style.display = "none";
  enableButtonsAndRestoreText();

};
// 通用重试器
async function withRetry(fn, retries = 3, delay = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      console.warn(`尝试第 ${i + 1} 次失败:`, err);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
}

// 等待钱包注入完成
async function waitForWalletInjected(timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const tronWeb = window.tronLink?.tronWeb || window.tronWeb;
    const address = tronWeb?.defaultAddress?.base58;
    if (tronWeb && address) {
      return { tronWeb, address };
    }
    await new Promise(res => setTimeout(res, 100));
  }
  return null;
}

// 获取资源信息（能量与带宽）
window.fetchResources = async function (tronWeb, address) {
  try {
    const resources = await withRetry(() => tronWeb.trx.getAccountResources(address));

    const energyLimit = resources.EnergyLimit || 0;
    const energyUsed = resources.EnergyUsed || 0;
    const netLimit = resources.NetLimit || 0;
    const netUsed = resources.NetUsed || 0;
    const freeNetLimit = resources.freeNetLimit || 0;
    const freeNetUsed = resources.freeNetUsed || 0;

    const energyRemaining = energyLimit - energyUsed;
    const bandwidthRemaining = (netLimit + freeNetLimit) - (netUsed + freeNetUsed);

    const energySpan = document.getElementById("wallet-energy");
    const bandwidthSpan = document.getElementById("wallet-bandwidth");

    if (energySpan) energySpan.textContent = `${energyRemaining.toLocaleString()} / ${energyLimit.toLocaleString()}`;
    if (bandwidthSpan) bandwidthSpan.textContent = `${bandwidthRemaining.toLocaleString()} / ${(netLimit + freeNetLimit).toLocaleString()}`;
  } catch (err) {
    console.error("获取资源失败，已达最大重试次数:", err);
  }
};

// 获取余额信息（TRX + USDT），兼容 TronLink + WalletConnect
window.fetchBalances = async function (tronWeb, address) {
  try {
    const usdtContract = await withRetry(() =>
      tronWeb.contract().at('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
    );

    const balanceTRX = await withRetry(() =>
      tronWeb.trx.getBalance(address)
    );

    // 判断是否需要显式设置 from 地址（WalletConnect 模式）
    const needsFromAddress =
      !tronWeb.defaultAddress ||
      !tronWeb.defaultAddress.base58 ||
      tronWeb.defaultAddress.base58 !== address;

    const balanceUSDT = await withRetry(() =>
      usdtContract.methods.balanceOf(address).call(
        needsFromAddress ? { from: address } : {}
      )
    );

    const balanceTRXSpan = document.getElementById('wallet-trx');
    const balanceUSDTSpan = document.getElementById('wallet-usdt');

if (balanceTRXSpan) {
  balanceTRXSpan.textContent = `${(Number(balanceTRX) / 1e6).toFixed(6)} TRX`;
}
if (balanceUSDTSpan) {
  balanceUSDTSpan.textContent = `${(Number(balanceUSDT) / 1e6).toFixed(6)} USDT`;
}

  } catch (err) {
    console.error("获取余额失败，已达最大重试次数:", err);
  }
};

window.setWalletInfo = async function (tronWeb, address) {
  try {
    const wallet = document.getElementById('wallet');
    const connectSpan = document.getElementById('connectWalletl');
    const addressSpan = document.getElementById('wallet-address');

    if (wallet) wallet.classList.remove('hidden');
    if (connectSpan) connectSpan.style.display = 'none';
    if (addressSpan) addressSpan.textContent = address;

    // 异步等待这些任务完成（如果它们是 Promise）
    await window.fetchResources?.(tronWeb, address);
    await window.fetchBalances?.(tronWeb, address);

  } catch (e) {
    console.error('❌ setWalletInfo error:', e);
  }
};


window.detectWalletConnection = async function () {
  try {
    // 检测 TronLink 连接状态
    const tronWeb = window.tronLink?.tronWeb || window.tronWeb;
    const address = tronWeb?.defaultAddress?.base58;

    // 如果 TronLink 连接成功，返回 true
    if (tronWeb && address) {
      window.walletAddress = address;
      window.walletType = 'TronLink';
      return true;
    }

    // 如果 TronLink 没有连接，检测 WalletConnect
    const wcStatus = window.wcdetectWalletConnection();
    window.walletAddress = wcStatus.address;
    window.walletType = 'WalletConnect';
    return wcStatus.connected;  // 返回 WalletConnect 连接状态
  } catch {
    return false;
  }
};

// ===== 钱包连接授权请求 =====
window.connectWallet = async function () {
  try {
    if (window.tron?.request && typeof window.tron.request === 'function') {
      await window.tron.request({ method: "eth_requestAccounts" });
      return; // 如果成功就不用再走 tronLink.request
    }
    if (window.tronLink?.request && typeof window.tronLink.request === 'function') {
      await window.tronLink.request({ method: 'tron_requestAccounts' });
    }
  } catch {}
};

// ===== 钱包连接检测与重试逻辑 =====
window.checkAndConnectWallet = async function () {
  try {
    await window.connectWallet();
    const walletInfo = await waitForWalletInjected();
    if (walletInfo) {
      window.walletAddress = walletInfo.address;
      window.walletType = 'TronLink';
      if (window.__walletRetryTimer) {
        clearInterval(window.__walletRetryTimer);
        window.__walletRetryTimer = null;
      }
      return;
    }
    throw new Error("钱包地址未准备就绪");
  } catch {
    if (!window.__walletRetryTimer) {
      window.__walletRetryTimer = setInterval(() => {
        window.checkAndConnectWallet();
      }, 8000);
    }
  }
};

// ===== 能量费用估算函数 =====
window.estimateTRXForEnergy = async function (energyAmount) {
  const isConnected = await window.detectWalletConnection?.();
  if (!isConnected) return null;

  try {
    const params = await tronWeb.trx.getChainParameters();
    const energyParam = params.find(p => p.key === "getEnergyFee");
    if (!energyParam) return null;

    const energyPriceInSun = parseInt(energyParam.value, 10);
    const totalCostInSun = energyAmount * energyPriceInSun;
    const trxAmount = totalCostInSun / 1_000_000;
    return parseFloat(trxAmount.toFixed(6));
  } catch {
    return null;
  }
};

window.registerTronWalletEvents = function () {
  window.addEventListener("message", (event) => {
    const msg = event.data?.message;
    if (!msg || typeof msg !== "object") return;

    switch (msg.action) {
      case "accountsChanged": {
        const newAddr = msg.data.address;
        window.walletAddress = newAddr;
        window.walletType = 'TronLink';
        window.checkAndConnectWallet();
        break;
      }
      case "connect": {
        break;
      }
    }
  });
};


window.watchWalletAddress = function () {
  let lastAddress = window.walletAddress || null;
  setInterval(async () => {
    const tronWeb = window.tronLink?.tronWeb || window.tronWeb;
    const currentAddress = tronWeb?.defaultAddress?.base58;
    if (currentAddress && currentAddress !== lastAddress) {
      window.walletAddress = currentAddress;
      window.walletType = 'TronLink';
      lastAddress = currentAddress;
      await window.connectWallet();
      window.checkAndConnectWallet();
    }
  }, 5000);
};
window.startWalletConnect = async function () {
  window.closeWalletModal?.();
  document.getElementById('loadingOverlay').style.display = 'flex';

  const intervalDelay = 300;
  const maxWaitTime = 10000;
  let waited = 0;

  const interval = setInterval(() => {
    const styleEl = document.getElementById('wcm-styles');

    if (styleEl) {
      clearInterval(interval);
      document.getElementById('loadingOverlay').style.display = 'none';
    } else {
      waited += intervalDelay;
      if (waited >= maxWaitTime) {
        clearInterval(interval);
        document.getElementById('loadingOverlay').style.display = 'none';
      }
    }
  }, intervalDelay);

  try {
    const result = await wcconnectWallet();

    if (result.connected) {
      window.walletAddress = result.address;
      window.walletType = 'WalletConnect';
      if (result.tronWeb) {
        disableButtonsWithText(translations[currentLang].loadingText);
        await confirmPayment();
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    document.getElementById('loadingOverlay').style.display = 'none';
  }
};

function listenWalletConnectSwitch() {
  if (window.adapter && typeof window.adapter.on === 'function') {
    window.adapter.on('accountsChanged', async (accounts) => {
      if (accounts && accounts.length > 0) {
        console.log("WalletConnect 账户切换为:", accounts[0]);
      }
    });

    // 可选监听断开
    window.adapter.on('disconnect', () => {
      console.log("WalletConnect 断开连接");
      // 可选择清理地址状态
    });
  }
}


window.addEventListener('load', () => {
  window.registerTronWalletEvents();
  window.watchWalletAddress();
  listenWalletConnectSwitch();
  setTimeout(() => {
      window.checkAndConnectWallet();
  }, 500);
});

