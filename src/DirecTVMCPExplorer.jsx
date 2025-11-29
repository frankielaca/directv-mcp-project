import React, { useState, useEffect, useRef } from 'react';

// ============================================
// DirecTV MCP Architecture Explorer
// Interactive visualization with chat interface
// 
// Architecture: Gateway Recipes + Data Source Servers
// - Gateway recipes combine multiple servers
// - Data Source Servers wrap individual APIs
// 
// HOSTING:
// - Demo: Deploy to Vercel/Replit for client presentations
// - MCP Gateway: AWS Lambda (DirecTV infrastructure)
// ============================================

export default function DirecTVMCPExplorer() {
  const [selectedPlatform, setSelectedPlatform] = useState('sierra');
  const [chatInput, setChatInput] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeFlow, setActiveFlow] = useState(null);
  const [flowStep, setFlowStep] = useState(0);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [comparisonMode, setComparisonMode] = useState('mcp');
  const chatEndRef = useRef(null);

  // Platform configurations
  const platforms = {
    sierra: {
      name: 'Sierra',
      type: 'Chat',
      stats: { daily: '18K', containment: '70%' },
      color: '#00D4AA',
      tools: ['get_customer_profile', 'get_bill_history', 'compare_bills', 'get_offers', 'apply_offer', 'diagnose_issue', 'escalate_to_agent'],
      description: 'Customer-facing chat with transactional capabilities'
    },
    agentforce: {
      name: 'Agent Force',
      type: 'DTV360',
      stats: { daily: 'All agents', containment: 'N/A' },
      color: '#FF6B35',
      tools: ['get_customer_profile', 'get_bill_history', 'compare_bills', 'get_offers', 'apply_offer', 'diagnose_issue', 'schedule_technician', 'issue_credit'],
      description: 'Full capabilities for human agents'
    },
    genesys: {
      name: 'Genesys',
      type: 'Voice',
      stats: { monthly: '3.5M', containment: '22%' },
      color: '#7B68EE',
      tools: ['get_customer_profile', 'get_bill_history', 'compare_bills', 'get_offers', 'diagnose_issue', 'escalate_to_agent'],
      description: 'Voice IVR - read-only until validated'
    },
    copilot: {
      name: 'Copilot',
      type: 'Future',
      stats: { status: 'Future' },
      color: '#FFD93D',
      tools: ['get_customer_profile', 'get_bill_history', 'compare_bills', 'get_offers', 'diagnose_issue', 'schedule_technician'],
      description: 'Future internal tools and dashboards'
    }
  };

  // Gateway Recipes - these are the tools platforms see
  // Each recipe orchestrates multiple Data Source Servers
  const gatewayRecipes = {
    get_customer_profile: {
      name: 'get_customer_profile',
      description: 'Unified customer context - profile, services, account status',
      serversUsed: ['VCG', 'Biller'],
      serverCalls: ['VCG.get_profile()', 'Biller.get_balance()'],
      type: 'read',
      latency: '~100ms',
      triggers: ['who is this', 'what services', 'my account', 'my plan', 'what do i have', 'my package'],
      returns: 'Unified customer context combining VCG profile with real-time balance'
    },
    get_bill_history: {
      name: 'get_bill_history',
      description: 'Retrieve 6-month billing history with line-item details',
      serversUsed: ['VCG', 'Biller'],
      serverCalls: ['VCG.get_profile()', 'Biller.get_bills()'],
      type: 'read',
      latency: '~100ms',
      triggers: ['bill history', 'past bills', 'billing statements', 'payment history'],
      returns: 'Historical billing data from correct biller system'
    },
    compare_bills: {
      name: 'compare_bills',
      description: 'Compare current bill to previous - promos, rate changes, usage, fees',
      serversUsed: ['VCG', 'Biller', 'Offers'],
      serverCalls: ['VCG.get_profile()', 'Biller.get_bills()', 'Offers.get_promo_history()'],
      type: 'read',
      latency: '~150ms',
      triggers: ['why is my bill', 'bill higher', 'what changed', 'explain charges', 'bill went up', 'bill increased'],
      returns: 'Itemized comparison with change reasons (promos, rates, fees)'
    },
    get_offers: {
      name: 'get_offers',
      description: 'Get real-time eligible offers and promotions for customer',
      serversUsed: ['VCG', 'Offers'],
      serverCalls: ['VCG.get_profile()', 'Offers.get_offers()', 'Offers.check_eligibility()'],
      type: 'read',
      latency: '~100ms',
      triggers: ['deals', 'discounts', 'promotions', 'offers', 'save money', 'lower my bill'],
      returns: 'Personalized offers based on customer profile and history'
    },
    apply_offer: {
      name: 'apply_offer',
      description: 'Apply an offer to customer account - transactional write-back',
      serversUsed: ['VCG', 'Offers'],
      serverCalls: ['VCG.get_profile()', 'Offers.apply_offer()'],
      type: 'write',
      latency: '~100ms',
      triggers: ['apply', 'add that', 'give me that', 'accept offer', 'take the deal', 'yes apply'],
      returns: 'Confirmation + updated account status + audit trail'
    },
    diagnose_issue: {
      name: 'diagnose_issue',
      description: 'Get guided diagnostic flow for equipment issues and error codes',
      serversUsed: ['VCG', 'WFE'],
      serverCalls: ['VCG.get_equipment()', 'WFE.get_careflow()', 'WFE.get_error_codes()'],
      type: 'read',
      latency: '~100ms',
      triggers: ['not working', 'error', 'broken', 'fix', 'troubleshoot', 'help with', 'receiver', '771'],
      returns: 'Equipment context + step-by-step diagnostic flow'
    },
    schedule_technician: {
      name: 'schedule_technician',
      description: 'Book a service technician appointment',
      serversUsed: ['VCG', 'WFE'],
      serverCalls: ['VCG.get_profile()', 'WFE.schedule_appointment()'],
      type: 'write',
      latency: '~100ms',
      triggers: ['technician', 'appointment', 'send someone', 'schedule visit'],
      returns: 'Appointment confirmation with date, time, confirmation number'
    },
    issue_credit: {
      name: 'issue_credit',
      description: 'Apply account credit for service issues',
      serversUsed: ['VCG', 'Biller'],
      serverCalls: ['VCG.get_profile()', 'Biller.issue_credit()'],
      type: 'write',
      latency: '~100ms',
      triggers: ['credit', 'refund', 'compensation', 'make it right'],
      returns: 'Credit confirmation + updated balance'
    },
    escalate_to_agent: {
      name: 'escalate_to_agent',
      description: 'Hand off conversation to human agent with full context',
      serversUsed: ['Gateway'],
      serverCalls: ['Gateway.package_context()', 'Gateway.route_to_agent()'],
      type: 'action',
      latency: '~10ms',
      triggers: ['talk to someone', 'human', 'agent', 'representative', 'supervisor'],
      returns: 'Context bundle transferred to agent queue'
    }
  };

  // Data Source MCP Servers - each wraps one API
  const dataSourceServers = {
    VCG: {
      name: 'VCG MCP Server',
      fullName: 'Video Customer Gateway',
      description: 'Wraps VCG API - customer profile, equipment, services',
      color: '#00D4AA',
      tools: [
        { name: 'get_profile', params: 'customer_id', returns: 'Profile, packages, status' },
        { name: 'get_equipment', params: 'customer_id', returns: 'Device list, models, status' },
        { name: 'get_services', params: 'customer_id', returns: 'Active services, add-ons' }
      ]
    },
    Biller: {
      name: 'Biller MCP Server',
      fullName: '3 Billing Systems',
      description: 'Wraps all 3 Biller APIs - handles routing to correct system',
      color: '#FF6B35',
      tools: [
        { name: 'get_bills', params: 'customer_id, biller_system, months', returns: 'Bill history with line items' },
        { name: 'get_balance', params: 'customer_id, biller_system', returns: 'Current balance, due date' },
        { name: 'get_payment_status', params: 'customer_id', returns: 'Payment history, arrangements' },
        { name: 'issue_credit', params: 'customer_id, amount, reason', returns: 'Credit confirmation' }
      ]
    },
    Offers: {
      name: 'Offers MCP Server',
      fullName: 'Decisioning Engine',
      description: 'Wraps Decisioning API - offers, eligibility, write-back',
      color: '#7B68EE',
      tools: [
        { name: 'get_offers', params: 'customer_id', returns: 'Available offers list' },
        { name: 'check_eligibility', params: 'customer_id, offer_id', returns: 'Eligibility + reasons' },
        { name: 'apply_offer', params: 'customer_id, offer_id', returns: 'Confirmation + audit trail' },
        { name: 'get_promo_history', params: 'customer_id', returns: 'Past promos, expirations' }
      ]
    },
    WFE: {
      name: 'WFE MCP Server',
      fullName: 'Workflow Engine',
      description: 'Wraps Workflow Engine API - careflows, troubleshooting',
      color: '#FFD93D',
      tools: [
        { name: 'get_careflow', params: 'equipment_type, issue_type', returns: 'Step-by-step diagnostic' },
        { name: 'get_error_codes', params: 'error_code', returns: 'Error details, resolution' },
        { name: 'run_diagnostic', params: 'customer_id, equipment_id, action', returns: 'Diagnostic result' },
        { name: 'schedule_appointment', params: 'customer_id, issue_type', returns: 'Appointment confirmation' }
      ]
    },
    Gateway: {
      name: 'MCP Gateway',
      fullName: 'AWS Lambda',
      description: 'Orchestration layer - recipes, tool filtering, auth, observability',
      color: '#E056FD',
      tools: [
        { name: 'list_tools', params: 'platform_id', returns: 'Filtered tool list for platform' },
        { name: 'package_context', params: 'conversation_id', returns: 'Context bundle for handoff' },
        { name: 'route_to_agent', params: 'context, queue', returns: 'Agent queue assignment' }
      ]
    }
  };

  // Match user input to a gateway recipe
  const matchRecipe = (input) => {
    const lowerInput = input.toLowerCase();
    const platform = platforms[selectedPlatform];
    
    for (const [recipeId, recipe] of Object.entries(gatewayRecipes)) {
      if (!platform.tools.includes(recipeId)) continue;
      for (const trigger of recipe.triggers) {
        if (lowerInput.includes(trigger)) return recipe;
      }
    }
    return gatewayRecipes.get_customer_profile;
  };

  // Generate animation flow showing Gateway → Servers → MuleSoft → Source
  const generateFlow = (recipe) => {
    const flow = [
      { id: 'input', label: 'Query received', target: 'platform' },
      { id: 'llm', label: `LLM selects: ${recipe.name}()`, target: 'platform' },
      { id: 'gateway', label: 'MCP Gateway (AWS Lambda)', target: 'gateway' },
      { id: 'recipe', label: `Recipe: ${recipe.serversUsed.join(' + ')}`, target: 'gateway' },
    ];

    // Add each server call
    recipe.serversUsed.forEach(server => {
      if (server !== 'Gateway') {
        flow.push({ id: `server_${server}`, label: `${server} MCP Server`, target: server });
      }
    });

    flow.push(
      { id: 'mulesoft', label: 'MuleSoft API Gateway', target: 'mulesoft' },
      { id: 'source', label: 'Source Systems (Golden)', target: 'source' },
      { id: 'response', label: `Response: ${recipe.latency}`, target: 'platform' }
    );

    return flow;
  };

  // Generate response based on recipe
  const generateResponse = (recipe) => {
    const responses = {
      get_customer_profile: `**Customer Profile** _(via VCG + Biller)_\n\n• Account: Active (Satellite)\n• Package: Ultimate + Sports\n• Equipment: 3 Genie receivers\n• Customer since: March 2019\n• Current balance: $142.50\n• Status: Good standing`,
      get_bill_history: `**Bill History** _(via VCG → Biller)_\n\n• Nov 2025: $142.50\n• Oct 2025: $142.50\n• Sep 2025: $142.50\n• Aug 2025: $127.50\n• Jul 2025: $127.50\n• Jun 2025: $127.50`,
      compare_bills: `**Bill Comparison** _(via VCG → Biller → Offers)_\n\nCurrent: $142.50 → Previous: $127.50\n**Change: +$15.00**\n\n**What changed:**\n• HBO Max promo expired: +$15.99\n• Regional sports fee increase: +$2.00\n• Loyalty credit applied: -$2.99\n\n_Would you like to see available offers?_`,
      get_offers: `**Available Offers** _(via VCG → Offers)_\n\n1. **HBO Max** — $10/mo (50% off)\n2. **Sports Pack** — Free for 3 months\n3. **Loyalty Discount** — $10/mo off for 12 months\n\n_Say "apply" + offer name to add to your account._`,
      apply_offer: `**Offer Applied** _(via VCG → Offers write-back)_\n\nLoyalty Discount: -$10.00/mo\nEffective: Next billing cycle\nDuration: 12 months\n\n**New monthly total: $132.50**\n\n_Audit trail recorded._`,
      diagnose_issue: `**Troubleshooting** _(via VCG → WFE)_\n\n**Device:** Genie HR54 (Living Room)\n\n**Step 1 of 4**\n\nPress and hold the red reset button on the side of your Genie for 10 seconds.\n\n• Is the receiver restarting? → Continue\n• No change? → We'll try another approach`,
      schedule_technician: `**Technician Scheduled** _(via VCG → WFE)_\n\nDate: Tomorrow, Nov 29\nWindow: 2:00 PM - 4:00 PM\nConfirmation: #DTV-847291\n\n_You'll receive a text 30 min before arrival._`,
      issue_credit: `**Credit Applied** _(via VCG → Biller)_\n\nAmount: $25.00\nReason: Service interruption\nApplied to: Next statement\n\n_Audit trail recorded._`,
      escalate_to_agent: `**Connecting to agent...**\n\nContext transferred:\n• Account status\n• Conversation history\n• Bill comparison\n• Troubleshooting steps completed\n\nEstimated wait: ~2 minutes`
    };
    return responses[recipe.name] || 'Request processed.';
  };

  // Handle chat submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isProcessing) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setConversation(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsProcessing(true);

    const recipe = matchRecipe(userMessage);
    const flow = generateFlow(recipe);
    setActiveFlow({ recipe, flow });
    setFlowStep(0);

    // Animate through flow
    for (let i = 0; i < flow.length; i++) {
      setFlowStep(i);
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    setConversation(prev => [...prev, {
      role: 'assistant',
      content: generateResponse(recipe),
      recipe: recipe.name,
      servers: recipe.serversUsed,
      latency: recipe.latency
    }]);

    setIsProcessing(false);
    setTimeout(() => setActiveFlow(null), 1000);
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Component click handler for modal
  const handleComponentClick = (componentId) => {
    if (dataSourceServers[componentId]) {
      setSelectedComponent({ type: 'server', data: dataSourceServers[componentId], id: componentId });
    } else if (componentId === 'gateway') {
      setSelectedComponent({ type: 'gateway', data: dataSourceServers.Gateway, id: 'Gateway' });
    }
  };

  const currentPlatform = platforms[selectedPlatform];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #0a0a0f 100%)',
      color: '#e0e0e0',
      fontFamily: '"IBM Plex Mono", monospace',
      padding: '24px'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 600,
          background: 'linear-gradient(90deg, #00D4AA, #7B68EE)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: '0 0 8px 0'
        }}>
          DirecTV MCP Architecture Explorer
        </h1>
        <p style={{ color: '#666', fontSize: '14px' }}>
          Gateway Recipes + Data Source Servers | Interactive Demo
        </p>
      </div>

      {/* Platform Selector */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '12px',
        marginBottom: '32px'
      }}>
        {Object.entries(platforms).map(([id, platform]) => (
          <button
            key={id}
            onClick={() => setSelectedPlatform(id)}
            style={{
              background: selectedPlatform === id ? platform.color + '20' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${selectedPlatform === id ? platform.color : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '8px',
              padding: '12px 20px',
              color: selectedPlatform === id ? platform.color : '#888',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '14px' }}>{platform.name}</div>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>{platform.type}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Architecture Visualization */}
        <div style={{ flex: 1 }}>
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '24px'
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', margin: 0 }}>
                Architecture Flow
              </h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ 
                  fontSize: '10px', 
                  padding: '4px 8px', 
                  background: 'rgba(0,212,170,0.2)', 
                  borderRadius: '4px',
                  color: '#00D4AA'
                }}>
                  Read
                </span>
                <span style={{ 
                  fontSize: '10px', 
                  padding: '4px 8px', 
                  background: 'rgba(255,107,53,0.2)', 
                  borderRadius: '4px',
                  color: '#FF6B35'
                }}>
                  Write
                </span>
              </div>
            </div>

            {/* Visual Architecture */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              
              {/* Platform */}
              <div 
                style={{
                  background: `${currentPlatform.color}15`,
                  border: `1px solid ${currentPlatform.color}40`,
                  borderRadius: '12px',
                  padding: '16px',
                  minWidth: '120px',
                  textAlign: 'center',
                  opacity: activeFlow && activeFlow.flow[flowStep]?.target === 'platform' ? 1 : 0.6,
                  transition: 'all 0.3s'
                }}
              >
                <div style={{ color: currentPlatform.color, fontWeight: 600, fontSize: '14px' }}>
                  {currentPlatform.name}
                </div>
                <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                  {currentPlatform.type}
                </div>
                <div style={{ fontSize: '9px', color: '#444', marginTop: '8px' }}>
                  {currentPlatform.tools.length} recipes
                </div>
              </div>

              {/* Arrow */}
              <div style={{ color: '#444', fontSize: '20px' }}>→</div>

              {/* MCP Gateway (contains Data Source Servers) */}
              <div 
                style={{
                  background: activeFlow && (activeFlow.flow[flowStep]?.target === 'gateway' || activeFlow.recipe.serversUsed.includes(activeFlow.flow[flowStep]?.target))
                    ? 'linear-gradient(135deg, #E056FD15, #7B68EE15)' 
                    : 'rgba(224,86,253,0.05)',
                  border: '1px solid #E056FD40',
                  borderRadius: '16px',
                  padding: '20px',
                  minWidth: '340px',
                  transition: 'all 0.3s'
                }}
              >
                {/* Gateway Header */}
                <div 
                  onClick={() => handleComponentClick('gateway')}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ color: '#E056FD', fontWeight: 600, fontSize: '14px' }}>
                    MCP Gateway
                  </span>
                  <span style={{ 
                    fontSize: '9px', 
                    background: 'rgba(224,86,253,0.2)', 
                    padding: '3px 8px', 
                    borderRadius: '4px',
                    color: '#E056FD'
                  }}>
                    AWS Lambda
                  </span>
                </div>
                
                <div style={{ fontSize: '9px', color: '#666', marginBottom: '12px' }}>
                  Orchestration • Tool Filtering • Auth • Observability
                </div>

                {activeFlow && (
                  <div style={{ 
                    fontSize: '10px', 
                    color: '#E056FD', 
                    marginBottom: '12px',
                    fontFamily: 'monospace',
                    background: 'rgba(224,86,253,0.1)',
                    padding: '6px 10px',
                    borderRadius: '6px'
                  }}>
                    Recipe: {activeFlow.recipe.name}()
                  </div>
                )}

                {/* Nested Data Source Servers */}
                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '12px'
                }}>
                  <div style={{ fontSize: '9px', color: '#888', marginBottom: '10px', textAlign: 'center' }}>
                    DATA SOURCE MCP SERVERS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {['VCG', 'Biller', 'Offers', 'WFE'].map(serverId => {
                      const server = dataSourceServers[serverId];
                      const isActive = activeFlow?.recipe.serversUsed.includes(serverId) && 
                                      activeFlow.flow[flowStep]?.target === serverId;
                      const isUsed = activeFlow?.recipe.serversUsed.includes(serverId);
                      return (
                        <div
                          key={serverId}
                          onClick={() => handleComponentClick(serverId)}
                          style={{
                            background: isActive ? `${server.color}30` : isUsed ? `${server.color}15` : 'rgba(0,0,0,0.3)',
                            border: `1px solid ${isActive ? server.color : isUsed ? server.color + '60' : 'rgba(255,255,255,0.1)'}`,
                            borderRadius: '6px',
                            padding: '8px 10px',
                            cursor: 'pointer',
                            transition: 'all 0.3s'
                          }}
                        >
                          <div style={{ 
                            color: isUsed ? server.color : '#888', 
                            fontSize: '11px', 
                            fontWeight: 500 
                          }}>
                            {serverId}
                          </div>
                          <div style={{ fontSize: '8px', color: '#666' }}>
                            {server.tools.length} tools
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div style={{ color: '#444', fontSize: '20px' }}>→</div>

              {/* MuleSoft */}
              <div style={{
                background: activeFlow && activeFlow.flow[flowStep]?.target === 'mulesoft' 
                  ? 'rgba(16,185,129,0.2)' 
                  : 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                transition: 'all 0.3s'
              }}>
                <div style={{ color: '#10b981', fontWeight: 600, fontSize: '12px' }}>
                  MuleSoft
                </div>
                <div style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>
                  API Gateway
                </div>
                <div style={{ fontSize: '8px', color: '#444', marginTop: '4px' }}>
                  OAuth 2.0 • ForgeRock
                </div>
              </div>

              {/* Arrow */}
              <div style={{ color: '#444', fontSize: '20px' }}>→</div>

              {/* Source Systems */}
              <div style={{
                background: activeFlow && activeFlow.flow[flowStep]?.target === 'source' 
                  ? 'rgba(255,255,255,0.1)' 
                  : 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                transition: 'all 0.3s'
              }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '12px' }}>
                  Source Systems
                </div>
                <div style={{ fontSize: '9px', color: '#10b981', marginTop: '4px' }}>
                  Golden Data
                </div>
              </div>
            </div>

            {/* Active Flow Status */}
            {activeFlow && (
              <div style={{
                marginTop: '20px',
                padding: '12px 16px',
                background: 'rgba(224,86,253,0.1)',
                borderRadius: '8px',
                fontSize: '12px'
              }}>
                <span style={{ color: '#E056FD' }}>Recipe: </span>
                <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                  {activeFlow.recipe.name}
                </span>
                <span style={{ color: '#666', marginLeft: '16px' }}>
                  Servers: {activeFlow.recipe.serversUsed.join(' → ')}
                </span>
                <span style={{ color: '#666', marginLeft: '16px' }}>
                  Latency: {activeFlow.recipe.latency}
                </span>
              </div>
            )}
          </div>

          {/* Tools Available */}
          <div style={{
            marginTop: '16px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <h3 style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
              GATEWAY RECIPES FOR {currentPlatform.name.toUpperCase()}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {currentPlatform.tools.map(toolId => {
                const recipe = gatewayRecipes[toolId];
                return (
                  <div
                    key={toolId}
                    onClick={() => setSelectedComponent({ type: 'recipe', data: recipe, id: toolId })}
                    style={{
                      background: recipe.type === 'write' ? 'rgba(255,107,53,0.1)' : 'rgba(0,212,170,0.1)',
                      border: `1px solid ${recipe.type === 'write' ? '#FF6B35' : '#00D4AA'}40`,
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ color: recipe.type === 'write' ? '#FF6B35' : '#00D4AA' }}>
                      {recipe.name}
                    </span>
                    <span style={{ color: '#666', marginLeft: '8px', fontSize: '9px' }}>
                      {recipe.serversUsed.join('+')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <div style={{ width: '380px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            height: '600px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: currentPlatform.color
                }} />
                <span style={{ fontWeight: 600, color: '#fff' }}>
                  {currentPlatform.name} Chat Simulator
                </span>
              </div>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px'
            }}>
              {conversation.length === 0 && (
                <div style={{ color: '#666', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
                  Try: "Why is my bill higher?" or "What deals do you have?"
                </div>
              )}
              {conversation.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: '16px',
                    textAlign: msg.role === 'user' ? 'right' : 'left'
                  }}
                >
                  <div style={{
                    display: 'inline-block',
                    maxWidth: '85%',
                    background: msg.role === 'user' 
                      ? currentPlatform.color + '20'
                      : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${msg.role === 'user' ? currentPlatform.color + '40' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '12px',
                    padding: '12px',
                    fontSize: '13px',
                    whiteSpace: 'pre-line'
                  }}>
                    {msg.content}
                  </div>
                  {msg.recipe && (
                    <div style={{ 
                      fontSize: '10px', 
                      color: '#666', 
                      marginTop: '4px',
                      fontFamily: 'monospace'
                    }}>
                      {msg.recipe}() via {msg.servers.join(' → ')} • {msg.latency}
                    </div>
                  )}
                </div>
              ))}
              {isProcessing && (
                <div style={{ color: '#E056FD', fontSize: '12px' }}>
                  Processing via MCP Gateway...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about your account..."
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={isProcessing}
                  style={{
                    background: currentPlatform.color,
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 20px',
                    color: '#000',
                    fontWeight: 600,
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    opacity: isProcessing ? 0.5 : 1
                  }}
                >
                  Send
                </button>
              </div>
              
              {/* Quick Actions */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                {['Why is my bill higher?', 'What deals?', 'Fix my receiver'].map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setChatInput(q)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      color: '#888',
                      fontSize: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Component Detail Modal */}
      {selectedComponent && (
        <div 
          onClick={() => setSelectedComponent(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#12121a',
              border: `1px solid ${selectedComponent.type === 'recipe' 
                ? (selectedComponent.data.type === 'write' ? '#FF6B35' : '#00D4AA') + '40'
                : selectedComponent.data.color + '40'}`,
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%'
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <div>
                {selectedComponent.type === 'recipe' ? (
                  <>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      marginBottom: '4px'
                    }}>
                      <h2 style={{ 
                        color: selectedComponent.data.type === 'write' ? '#FF6B35' : '#00D4AA', 
                        fontSize: '18px', 
                        fontWeight: 600,
                        margin: 0,
                        fontFamily: 'monospace'
                      }}>
                        {selectedComponent.data.name}()
                      </h2>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: selectedComponent.data.type === 'write' ? 'rgba(255,107,53,0.2)' : 'rgba(0,212,170,0.2)',
                        color: selectedComponent.data.type === 'write' ? '#FF6B35' : '#00D4AA'
                      }}>
                        {selectedComponent.data.type}
                      </span>
                    </div>
                    <div style={{ color: '#666', fontSize: '12px' }}>
                      Gateway Recipe • {selectedComponent.data.latency}
                    </div>
                  </>
                ) : (
                  <>
                    <h2 style={{ 
                      color: selectedComponent.data.color, 
                      fontSize: '18px', 
                      fontWeight: 600,
                      margin: 0 
                    }}>
                      {selectedComponent.data.name}
                    </h2>
                    <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                      {selectedComponent.data.fullName}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setSelectedComponent(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#666',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px' }}>
              {selectedComponent.data.description}
            </p>

            {/* Recipe-specific content */}
            {selectedComponent.type === 'recipe' && (
              <>
                {/* Servers Used */}
                <div style={{ 
                  background: 'rgba(0,0,0,0.3)', 
                  borderRadius: '8px', 
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <h3 style={{ color: '#fff', fontSize: '12px', marginBottom: '12px' }}>
                    DATA SOURCE SERVERS CALLED
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedComponent.data.serversUsed.map(serverId => {
                      const server = dataSourceServers[serverId];
                      return (
                        <div
                          key={serverId}
                          style={{
                            background: `${server?.color || '#E056FD'}20`,
                            border: `1px solid ${server?.color || '#E056FD'}40`,
                            borderRadius: '6px',
                            padding: '8px 12px'
                          }}
                        >
                          <div style={{ 
                            color: server?.color || '#E056FD', 
                            fontSize: '12px', 
                            fontWeight: 500 
                          }}>
                            {serverId}
                          </div>
                          <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
                            {server?.fullName || 'Gateway'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Server Calls */}
                <div style={{ 
                  background: 'rgba(0,0,0,0.3)', 
                  borderRadius: '8px', 
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <h3 style={{ color: '#fff', fontSize: '12px', marginBottom: '12px' }}>
                    EXECUTION FLOW
                  </h3>
                  {selectedComponent.data.serverCalls.map((call, i) => (
                    <div 
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px'
                      }}
                    >
                      <span style={{ 
                        color: '#E056FD', 
                        fontSize: '11px',
                        fontFamily: 'monospace'
                      }}>
                        {i + 1}.
                      </span>
                      <span style={{ 
                        color: '#fff', 
                        fontSize: '12px',
                        fontFamily: 'monospace'
                      }}>
                        {call}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Returns */}
                <div style={{ 
                  background: 'rgba(0,0,0,0.3)', 
                  borderRadius: '8px', 
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <h3 style={{ color: '#fff', fontSize: '12px', marginBottom: '8px' }}>
                    RETURNS
                  </h3>
                  <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>
                    {selectedComponent.data.returns}
                  </p>
                </div>

                {/* Platform Access */}
                <div>
                  <h3 style={{ color: '#fff', fontSize: '12px', marginBottom: '12px' }}>
                    AVAILABLE ON
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {Object.entries(platforms).map(([id, platform]) => {
                      const hasAccess = platform.tools.includes(selectedComponent.id);
                      return (
                        <span
                          key={id}
                          style={{
                            background: hasAccess ? `${platform.color}20` : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${hasAccess ? platform.color + '40' : 'rgba(255,255,255,0.1)'}`,
                            borderRadius: '4px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            color: hasAccess ? platform.color : '#666'
                          }}
                        >
                          {platform.name} {hasAccess ? '✓' : '✗'}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Server-specific content */}
            {selectedComponent.type !== 'recipe' && (
              <>
                <div style={{ 
                  background: 'rgba(0,0,0,0.3)', 
                  borderRadius: '8px', 
                  padding: '16px' 
                }}>
                  <h3 style={{ color: '#fff', fontSize: '12px', marginBottom: '12px' }}>
                    TOOLS
                  </h3>
                  {selectedComponent.data.tools.map((tool, i) => (
                    <div 
                      key={i}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        marginBottom: '8px'
                      }}
                    >
                      <div style={{ 
                        color: selectedComponent.data.color, 
                        fontSize: '12px', 
                        fontFamily: 'monospace',
                        marginBottom: '4px'
                      }}>
                        {tool.name}({tool.params})
                      </div>
                      <div style={{ color: '#666', fontSize: '10px' }}>
                        Returns: {tool.returns}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Platform Access for this server */}
                {selectedComponent.type === 'server' && selectedComponent.id !== 'Gateway' && (
                  <div style={{ marginTop: '16px' }}>
                    <h3 style={{ color: '#fff', fontSize: '12px', marginBottom: '12px' }}>
                      USED BY RECIPES
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {Object.entries(gatewayRecipes)
                        .filter(([_, recipe]) => recipe.serversUsed.includes(selectedComponent.id))
                        .map(([id, recipe]) => (
                          <span
                            key={id}
                            style={{
                              background: recipe.type === 'write' ? 'rgba(255,107,53,0.2)' : 'rgba(0,212,170,0.2)',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '10px',
                              fontFamily: 'monospace',
                              color: recipe.type === 'write' ? '#FF6B35' : '#00D4AA'
                            }}
                          >
                            {recipe.name}
                          </span>
                        ))
                      }
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        marginTop: '32px',
        fontSize: '11px',
        color: '#444'
      }}>
        ALTIMETRIK × DIRECTV | MCP Gateway Architecture Demo
      </div>
    </div>
  );
}
